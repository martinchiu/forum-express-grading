const bcrypt = require('bcryptjs')
const Sequelize = require('sequelize')
const { User, Comment, Restaurant, Favorite, Like, Followship } = require('../models')
const { imgurFileHandler } = require('../helpers/file-helpers')
const { getUser } = require('../helpers/auth-helpers')
const userController = {
  signUpPage: (req, res) => {
    res.render('signup')
  },
  signUp: (req, res, next) => {
    if (req.body.password !== req.body.passwordCheck) throw new Error('Passwords do not match!')

    User.findOne({ where: { email: req.body.email } })
      .then(user => {
        if (user) throw new Error('Email already exists!')
        return bcrypt.hash(req.body.password, 10) // 前面加 return
      })
      .then(hash => User.create({
        name: req.body.name,
        email: req.body.email,
        password: hash
      }))
      .then(() => {
        req.flash('success_messages', '成功註冊帳號！')
        res.redirect('/signin')
      })
      .catch(err => next(err))
  },
  signInPage: (req, res) => {
    res.render('signin')
  },
  signIn: (req, res) => {
    req.flash('success_messages', '成功登入！')
    res.redirect('/restaurants')
  },
  logout: (req, res) => {
    req.flash('success_messages', '登出成功！')
    req.logout()
    res.redirect('/signin')
  },
  getUser: (req, res, next) => {
    const currentUser = getUser(req)
    return Promise.all([
      User.findByPk(req.params.id,
        {
          include: [
            Comment,
            { model: User, as: 'Followers' },
            { model: User, as: 'Followings' }
          ]
        }),
      Comment.findAll({
        where: { userId: req.params.id },
        include: [Restaurant],
        raw: true,
        nest: true,
        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('restaurant_id')), 'unduplicatedRestId']] // 過濾使用者評論過重複的餐廳
      }),
      Favorite.findAll({
        raw: true,
        nest: true,
        where: { userId: req.params.id },
        include: [Restaurant]
      })
    ])
      .then(([user, comments, fav]) => {
        if (!user) throw new Error("User didn't exist!")
        return res.render('users/profile', { user: user.toJSON(), currentUser, comments, fav })
      })
      .catch(err => next(err))
  },
  editUser: (req, res, next) => {
    // 使用者只可以編輯自己的個人資料
    const userId = getUser(req).id || req.params.id
    return User.findByPk(userId, { raw: true })
      .then(user => {
        if (!user) throw new Error("User didn't exist!")
        res.render('users/edit', { user })
      })
      .catch(err => next(err))
  },
  putUser: (req, res, next) => {
    // 使用者只可以編輯自己的個人資料
    const userId = getUser(req).id || req.params.id
    const { name } = req.body
    if (!name.trim()) throw new Error('User name is required!')
    const { file } = req
    return Promise.all([
      User.findByPk(userId),
      imgurFileHandler(file)
    ])
      .then(([user, filePath]) => {
        if (!user) throw new Error("User didn't exist!")
        return user.update({
          name,
          image: filePath || user.image
        })
      })
      .then(() => {
        req.flash('success_messages', '使用者資料編輯成功')
        return res.redirect(`/users/${userId}`)
      })
      .catch(err => next(err))
  },
  addFavorite: async (req, res, next) => {
    try {
      const { restaurantId } = req.params
      const restaurant = await Restaurant.findByPk(restaurantId)
      if (!restaurant) throw new Error("Restaurant didn't exist!")

      const fav = await Favorite.findOne({
        where: {
          userId: req.user.id,
          restaurantId
        }
      })
      if (fav) throw new Error('You have liked this restaurant!')
      await Favorite.create({
        userId: req.user.id,
        restaurantId
      })
      return res.redirect('back')
    } catch (err) { next(err) }
  },
  removeFavorite: (req, res, next) => {
    return Favorite.findOne({
      where: {
        userId: req.user.id,
        restaurantId: req.params.restaurantId
      }
    })
      .then(favorite => {
        if (!favorite) throw new Error("You haven't favorited this restaurant")

        return favorite.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  addLike: async (req, res, next) => {
    try {
      const { restaurantId } = req.params
      const restaurant = await Restaurant.findByPk(restaurantId)
      if (!restaurant) throw new Error("Restaurant didn't exist!")

      const [like, create] = await Like.findOrCreate({
        where: {
          userId: req.user.id,
          restaurantId
        }
      })
      if (!create) throw new Error('You have liked this restaurant!')
      res.redirect('back')
    } catch (err) { next(err) }
  },
  removeLike: (req, res, next) => {
    return Like.findOne({
      where: {
        userId: req.user.id,
        restaurantId: req.params.restaurantId
      }
    })
      .then(like => {
        if (!like) throw new Error("You haven't liked this restaurant")

        return like.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  getTopUsers: (req, res, next) => {
    return User.findAll({
      include: [{ model: User, as: 'Followers' }]
    })
      .then(users => {
        // 整理 users 資料，把每個 user 項目都拿出來處理一次，並把新陣列儲存在 users 裡
        const result = users
          .map(user => ({
            // 整理格式
            ...user.toJSON(),
            followerCount: user.Followers.length,
            isFollowed: req.user.Followings.some(f => f.id === user.id)
          }))
          .sort((a, b) => b.followerCount - a.followerCount)
        res.render('top-users', { users: result })
      })
      .catch(err => next(err))
  },
  addFollowing: (req, res, next) => {
    const { userId } = req.params
    const currentUser = getUser(req)
    if (Number(userId) === currentUser.id) throw new Error('User is forbidden following yourself!')
    Promise.all([
      User.findByPk(userId),
      Followship.findOne({
        where: {
          followerId: req.user.id,
          followingId: userId
        }
      })
    ])
      .then(([user, followship]) => {
        if (!user) throw new Error("User didn't exist!")
        if (followship) throw new Error('You are already following this user!')
        return Followship.create({
          followerId: req.user.id,
          followingId: userId
        })
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  removeFollowing: (req, res, next) => {
    Followship.findOne({
      where: {
        followerId: req.user.id,
        followingId: req.params.userId
      }
    })
      .then(followship => {
        if (!followship) throw new Error("You haven't followed this user!")
        return followship.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  }
}
module.exports = userController
