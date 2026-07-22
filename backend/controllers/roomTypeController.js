const RoomType = require('../models/RoomType');
const Room = require('../models/Room');

exports.getAllRoomTypes = async (req, res) => {
  try {
    const roomTypes = await RoomType.find().sort({ name: 1 });
    res.json({ success: true, count: roomTypes.length, data: roomTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomTypeById = async (req, res) => {
  try {
    const roomType = await RoomType.findById(req.params.id);
    if (!roomType) {
      return res.status(404).json({ success: false, message: 'Room type not found' });
    }
    res.json({ success: true, data: roomType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRoomType = async (req, res) => {
  try {
    const { name } = req.body;
    const existing = await RoomType.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) {
      return res.status(400).json({ success: false, message: `Room type '${name}' already exists.` });
    }

    const roomType = await RoomType.create(req.body);
    res.status(201).json({ success: true, data: roomType });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateRoomType = async (req, res) => {
  try {
    const { name } = req.body;
    if (name) {
      const existing = await RoomType.findOne({
        name: new RegExp(`^${name}$`, 'i'),
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `Room type '${name}' already exists.` });
      }
    }

    const roomType = await RoomType.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!roomType) {
      return res.status(404).json({ success: false, message: 'Room type not found' });
    }
    res.json({ success: true, data: roomType });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteRoomType = async (req, res) => {
  try {
    const roomType = await RoomType.findById(req.params.id);
    if (!roomType) {
      return res.status(404).json({ success: false, message: 'Room type not found' });
    }

    // Check if there are rooms associated with this room type
    const roomsCount = await Room.countDocuments({ type: roomType.name });
    if (roomsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete room type '${roomType.name}' because it is in use by ${roomsCount} room(s).`
      });
    }

    await RoomType.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Room type deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
