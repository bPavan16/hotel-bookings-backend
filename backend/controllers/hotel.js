import Hotel from '../models/Hotel.js';

// CREATE
export const createHotel = async (req, res, next) => {
    const newHotel = new Hotel(req.body);
    try {
        const savedHotel = await newHotel.save();
        res.status(200).json(savedHotel);
    } catch (error) {
        res.status(500).json(error);
    }
};

// UPDATE
export const updateHotel = async (req, res, next) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        if (hotel.userId === req.body.userId) {
            await hotel.updateOne({ $set: req.body });
            res.status(200).json("The hotel has been updated");
        } else {
            res.status(403).json("You can update only your hotel");
        }
    } catch (error) {
        res.status(500).json(error);
    }
};

// DELETE
export const deleteHotel = async (req, res, next) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        if (hotel.userId === req.body.userId) {
            await hotel.deleteOne();
            res.status(200).json("The hotel has been deleted");
        } else {
            res.status(403).json("Unsuccessful deletion. You can delete only your hotel");
        }
    } catch (error) {
        res.status(500).json(error);
    }
};

// GET
export const getHotel = async (req, res, next) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        res.status(200).json(hotel);
    } catch (error) {
        res.status(500).json(error);
    }
};

// GET ALL
export const getAllHotels = async (req, res, next) => {
    const city = req.query.city;
    const type = req.query.type;
    try {
        let hotels;
        if (city) {
            hotels = await Hotel.find({ city: city });
        } else if (type) {
            hotels = await Hotel.find({ type: type });
        } else {
            hotels = await Hotel.find();
        }
        res.status(200).json(hotels);
    } catch (error) {
        next(error);
    }
};