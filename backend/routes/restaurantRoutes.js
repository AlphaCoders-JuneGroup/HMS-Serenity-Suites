const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getMenu,
  createMenuItem,
  updateMenuItem,
  uploadMenuImage,
  toggleMenuAvailability,
  deleteMenuItem,
  getTables,
  createTable,
  updateTable,
  deleteTable,
  getKitchenQueue,
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  addPayment,
  generateBill,
  notifyReceipt,
  getDailySales,
  getSalesRange,
  getCurrentShift,
  openShift,
  closeShift,
  getShifts,
} = require('../controllers/restaurantController');

const viewRoles = ['Admin', 'Manager', 'Restaurant Staff'];
const manageRoles = ['Admin', 'Restaurant Staff'];

const menuImagesDir = path.join(__dirname, '..', 'uploads', 'menu-images');
fs.mkdirSync(menuImagesDir, { recursive: true });

const menuImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, menuImagesDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

router.use(protect);

// Menu
router.get('/menu', authorize(...viewRoles), getMenu);
router.post('/menu', authorize(...manageRoles), createMenuItem);
router.put('/menu/:id', authorize(...manageRoles), updateMenuItem);
router.post(
  '/menu/:id/image',
  authorize(...manageRoles),
  menuImageUpload.single('image'),
  uploadMenuImage
);
router.patch('/menu/:id/availability', authorize(...manageRoles), toggleMenuAvailability);
router.delete('/menu/:id', authorize(...manageRoles), deleteMenuItem);

// Tables
router.get('/tables', authorize(...viewRoles), getTables);
router.post('/tables', authorize(...manageRoles), createTable);
router.put('/tables/:id', authorize(...manageRoles), updateTable);
router.delete('/tables/:id', authorize(...manageRoles), deleteTable);

// Kitchen
router.get('/kitchen', authorize(...viewRoles), getKitchenQueue);

// Sales & shifts (before :id)
router.get('/sales/daily', authorize(...viewRoles), getDailySales);
router.get('/sales/range', authorize(...viewRoles), getSalesRange);
router.get('/shifts/current', authorize(...viewRoles), getCurrentShift);
router.get('/shifts', authorize(...viewRoles), getShifts);
router.post('/shifts/open', authorize(...manageRoles), openShift);
router.post('/shifts/close', authorize(...manageRoles), closeShift);

// Orders
router.get('/orders', authorize(...viewRoles), getOrders);
router.get('/orders/:id', authorize(...viewRoles), getOrderById);
router.post('/orders', authorize(...manageRoles), createOrder);
router.put('/orders/:id', authorize(...manageRoles), updateOrder);
router.patch('/orders/:id/status', authorize(...manageRoles), updateOrderStatus);
router.post('/orders/:id/payments', authorize(...manageRoles), addPayment);
router.patch('/orders/:id/bill', authorize(...manageRoles), generateBill);
router.post('/orders/:id/notify', authorize(...manageRoles), notifyReceipt);

module.exports = router;
