'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('crypto_assets', 'logoUrlLocal', {
      type: Sequelize.DataTypes.STRING(1024),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('crypto_assets', 'logoUrlLocal');
  },
};
