import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoute from './routes/auth.js';
import usersRoute from './routes/users.js';
import hotelsRoute from './routes/hotels.js';
import roomsRoute from './routes/rooms.js';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();

function connect_toDb() {
    try {
        mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.log('MongoDB connection error', error);
    }
}


mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
    connect_toDb();
});



// Middleware

app.use(cookieParser())
app.use(express.json());

app.use("/api/auth", authRoute);
app.use("/api/users", usersRoute);
app.use("/api/hotels", hotelsRoute);
app.use("/api/rooms", roomsRoute);

app.use((err, req, res, next) => {
    console.error(err);
    const errorStatus = err.status || 500;
    const errorMessage = err.message || 'Something broke!';
    res.status(errorStatus).send({
        success: false,
        status: errorStatus,
        message: errorMessage,
        stack: err.stack,
    });

});


app.listen(8800, () => {
    connect_toDb();
    console.log('Server is running on port 8800');
    console.log('http://localhost:8800');
});

app.get('/', (req, res) => {
    res.send('Server is running successfully  ');
});