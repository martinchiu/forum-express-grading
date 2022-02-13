'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM Users;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    )
    await queryInterface.bulkInsert('Followships', [{
      follower_id: users[0].id,
      following_id: users[1].id,
      created_at: new Date(),
      updated_at: new Date()
    }, {
      follower_id: users[0].id,
      following_id: users[2].id,
      created_at: new Date(),
      updated_at: new Date()
    }, {
      follower_id: users[1].id,
      following_id: users[0].id,
      created_at: new Date(),
      updated_at: new Date()
    }, {
      follower_id: users[1].id,
      following_id: users[2].id,
      created_at: new Date(),
      updated_at: new Date()
    }
    ])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Followships', null, {})
  }
}
