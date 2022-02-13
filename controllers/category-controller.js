const { Category, Restaurant } = require('../models')
const categoryController = {
  getCategories: (req, res, next) => {
    return Promise.all([
      Category.findAll({ raw: true }),
      req.params.id ? Category.findByPk(req.params.id, { raw: true }) : null
    ])
      .then(([categories, category]) => {
        res.render('admin/categories', {
          categories,
          category
        })
      })
      .catch(err => next(err))
  },
  postCategory: (req, res, next) => {
    const { name } = req.body
    if (!name) throw new Error('Category name is required!')
    Category.create({ name })
      .then(() => {
        req.flash('success_messages', 'category was successfully created')
        res.redirect('/admin/categories')
      })
      .catch(err => next(err))
  },
  putCategory: (req, res, next) => {
    const { name } = req.body
    if (!name) throw new Error('Category name is required!')
    return Category.findByPk(req.params.id)
      .then(category => {
        if (!category) throw new Error("Category doesn't exist!")
        return category.update({ name })
      })
      .then(() => {
        req.flash('success_messages', 'restaurant was successfully to update')
        res.redirect('/admin/categories')
      })
      .catch(err => next(err))
  },
  deleteCategory: async (req, res, next) => {
    try {
      const category = await Category.findByPk(req.params.id, { include: [Restaurant] })
      if (!category) throw new Error("Category didn't exist!")
      if (category.dataValues.name === '未分類') throw new Error('未分類不能被刪除!')

      if (category.Restaurants.length) {
        const uncategorized = await Category.findOrCreate({ where: { name: '未分類' }, raw: true, nest: true })
        await Restaurant.update({ categoryId: uncategorized[0].id }, { where: { categoryId: req.params.id }, raw: true, nest: true })
      }
      await category.destroy()
      return res.redirect('/admin/categories')
    } catch (err) { next(err) }
  }
}
module.exports = categoryController
