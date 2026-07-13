const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getMenu,
  createMenuItem,
  updateMenuItem,
  toggleMenuAvailability,
  deleteMenuItem,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  generateBill,
  getDailySales,
} = require('../controllers/restaurantController');

const viewRoles = ['Admin', 'Manager', 'Restaurant Staff'];
const manageRoles = ['Admin', 'Restaurant Staff']; // Manager view-only

router.use(protect);

// Menu
router.get('/menu', authorize(...viewRoles), getMenu);
router.post('/menu', authorize(...manageRoles), createMenuItem);
router.put('/menu/:id', authorize(...manageRoles), updateMenuItem);
router.patch('/menu/:id/availability', authorize(...manageRoles), toggleMenuAvailability);
router.delete('/menu/:id', authorize(...manageRoles), deleteMenuItem);

// Sales (before /orders/:id)
router.get('/sales/daily', authorize(...viewRoles), getDailySales);

// Orders
router.get('/orders', authorize(...viewRoles), getOrders);
router.get('/orders/:id', authorize(...viewRoles), getOrderById);
router.post('/orders', authorize(...manageRoles), createOrder);
router.patch('/orders/:id/status', authorize(...manageRoles), updateOrderStatus);
router.patch('/orders/:id/bill', authorize(...manageRoles), generateBill);

module.exports = router;
