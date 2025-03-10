# Hotel Booking Backend

This is a backend system for a hotel booking application built with Node.js, Express.js, and MongoDB. It provides RESTful APIs for user authentication, hotel and room management, and booking functionalities.

## Features

- User authentication (Login & Register)
- Role-based access control (Admin/User)
- Hotel & Room management (CRUD operations)
- Room availability management
- Secure authentication using JWT
- MongoDB as the database

## Technologies Used

- Node.js
- Express.js
- MongoDB & Mongoose
- JWT Authentication
- Bcrypt for password hashing

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/bPavan16/hotel-booking-backend.git
   cd hotel-booking-backend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create a `.env` file and add the following variables:
   ```env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   PORT=5000
   ```
4. Start the server:
   ```sh
   npm start
   ```

## API Endpoints

### Authentication
| Method | Endpoint    | Description          |
|--------|------------|----------------------|
| POST   | /api/auth/register | Register a new user |
| POST   | /api/auth/login    | Login user          |

### Users
| Method | Endpoint    | Description         |
|--------|------------|---------------------|
| PUT    | /api/users/:id | Update user info   |
| DELETE | /api/users/:id | Delete user        |
| GET    | /api/users/:id | Get a user         |
| GET    | /api/users/  | Get all users (Admin) |

### Rooms
| Method | Endpoint    | Description        |
|--------|------------|--------------------|
| POST   | /api/rooms/:hotelid | Create a new room |
| PUT    | /api/rooms/:id      | Update a room     |
| PUT    | /api/rooms/availability/:id | Update room availability |
| DELETE | /api/rooms/:id/:hotelid | Delete a room |
| GET    | /api/rooms/:id      | Get a specific room |
| GET    | /api/rooms/         | Get all rooms |

## Usage

1. Register as a user via the `/api/auth/register` endpoint.
2. Login using `/api/auth/login` to receive a JWT token.
3. Use the token for authenticated routes by adding it to the `Authorization` header.
4. Admin users can manage hotels and rooms.
5. Users can view available rooms and book them.

## Contributing

Contributions are welcome! Follow these steps:

1. Fork the repository.
2. Create a new branch:
   ```sh
   git checkout -b feature-branch
   ```
3. Make changes and commit:
   ```sh
   git commit -m "Add new feature"
   ```
4. Push to your branch:
   ```sh
   git push origin feature-branch
   ```
5. Open a pull request.

### Creating a Frontend

To contribute a frontend for this backend:

1. Use a frontend framework like React, Angular, or Vue.js.
2. Set up API calls to interact with the backend endpoints.
3. Implement user authentication by storing and using JWT tokens.
4. Design a user-friendly UI for booking hotels and managing rooms.
5. Ensure proper state management and error handling.
6. Submit your frontend contribution by following the standard contribution steps above.

## License

This project is licensed under the MIT License.

