# Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Git

## Project Structure

```
medical_doctor/
├── backend/           # Node.js/Express backend
│   ├── config/        # Configuration files
│   ├── routes/        # API route definitions
│   ├── services/      # Business logic
│   ├── models/        # Database models
│   ├── middleware/    # Custom middleware
│   ├── server.js      # Entry point
│   └── package.json   # Backend dependencies
├── frontend/          # React frontend
│   ├── public/        # Static assets
│   ├── src/           # React components
│   ├── package.json   # Frontend dependencies
│   └── tailwind.config.js  # Tailwind configuration
├── docs/              # Documentation
└── README.md          # Project overview
```

## Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the backend directory with the following content:
   ```
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/intellicare
   JWT_SECRET=your_jwt_secret_here
   MODEL_API_KEY=your_model_api_key_here
   ```

4. Make sure MongoDB is running:
   ```
   mongod
   ```

5. Start the backend server:
   ```
   npm start
   ```
   
   Or for development with auto-reload:
   ```
   npm run dev
   ```

## Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

   The frontend will be available at http://localhost:3000

## Development Workflow

### Backend Development

1. All new API routes should be added in the `routes/` directory
2. Business logic should be implemented in the `services/` directory
3. Database models should be defined in the `models/` directory
4. Configuration should be managed in the `config/` directory

### Frontend Development

1. Create new components in the `src/components/` directory
2. Use Tailwind CSS for styling
3. Follow the existing component structure and naming conventions
4. Use React Router for navigation between pages

## Medical Model Integration

The application is designed to integrate with various open-source medical models:

1. **OpenMRS** - Open-source medical records system
2. **Med-PaLM** - Google's medical large language model
3. **BioGPT** - Microsoft's biomedical language model

To integrate a new model:
1. Add model configuration in `backend/config/default.json`
2. Implement model interface in `backend/services/medicalModelService.js`
3. Update frontend to display model-specific information if needed

## Testing

### Backend Testing

Run backend tests:
```
cd backend
npm test
```

### Frontend Testing

Run frontend tests:
```
cd frontend
npm test
```

## Deployment

### Backend Deployment

1. Set environment variables for production:
   ```
   NODE_ENV=production
   MONGODB_URI=your_production_mongodb_uri
   JWT_SECRET=your_production_jwt_secret
   ```

2. Build and start the server:
   ```
   npm start
   ```

### Frontend Deployment

1. Build the production version:
   ```
   cd frontend
   npm run build
   ```

2. Deploy the contents of the `build/` directory to your web server

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file
   - Verify network connectivity to MongoDB server

2. **Port Already in Use**
   - Change PORT in .env file
   - Kill processes using the port:
     ```
     kill $(lsof -t -i:5000)
     ```

3. **Dependency Installation Issues**
   - Delete node_modules and package-lock.json
   - Run `npm install` again
   - Check Node.js version compatibility

### Getting Help

If you encounter issues not covered in this guide:
1. Check the project issues on GitHub
2. Contact the development team
3. Refer to documentation for individual technologies (Node.js, React, MongoDB)