// Required dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('./config/db');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const User = require('./models/User');
const UserInput = require('./models/UserInput');
const bcrypt = require('bcryptjs');
const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(session({
    secret: '123456', // replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // for production, set secure to true with HTTPS
}));

// Set EJS as the template engine
app.set('view engine', 'ejs');

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Set up multer for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route for the root path, rendering the home page
app.get('/', (req, res) => {
    res.render('index', { title: 'CreditScoreTracker' ,user: req.session.user});
});

// Route for the login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Route for the signup page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Route for the credit score page
app.get('/creditscore', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    try {
        const user = req.session.user || null;  // Fetch user from session or initialize as null
        const userInput = req.session.userInput || null;
        const previousScores = await UserInput.find({ userId: req.session.userId }).sort({ createdAt: -1 });
        res.render('creditscore', { user,userInput,previousScores });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.get('/form', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    
    res.render('form', { user: req.session.user });
});

// Handle signup form submission
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        // Hash the password before saving to the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user with the hashed password
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        res.redirect('/login');
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error code
            res.status(400).json({ message: 'Email already exists!' });
        } else {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
});

// Handle login form submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find the user by email
        const user = await User.findOne({ email });
        if (user) {
            // Compare the provided password with the stored hashed password
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                // Store user ID in session and redirect to the credit score page after successful login
                const userInput = await UserInput.findOne({ userId: user._id });
                req.session.userId = user._id;
                req.session.user = user; 
                req.session.userInput = userInput ? { score: userInput.score } : null;
                res.redirect('/creditscore');
            } else {
                res.status(401).json({ message: 'Invalid credentials' });
            }


        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Handle logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect('/');
    });
});

// Handle form submission for utility payments and ID proof
// Handle form submission for utility payments and ID proof
app.post('/results', upload.single('idProof'), async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    try {
        const {
            electricityBill,
            waterBill,
            gasBill,
            mobileRecharge,
            employmentTenure,
            dataUsage,
            rationCardValue,
            minBankBalance,
            collateralValue
        } = req.body;
        const idProof = req.file.buffer;
        const idProofContentType = req.file.mimetype;

        // Example average values; replace with actual data
        const avgUtilityPayment = 100; 
        const avgMobileRecharge = 50;
        const avgEmploymentTenure = 5; 
        const avgDataUsage = 100; 
        const avgRationCardValue = 500; 
        const avgMinBankBalance = 1000; 
        const avgCollateralValue = 10000; 

        // Calculating the individual scores based on the provided formulas
        const UP = ((parseFloat(electricityBill) + parseFloat(waterBill) + parseFloat(gasBill)) / avgUtilityPayment) * 100;
        const MR = (parseFloat(mobileRecharge) / avgMobileRecharge) * 100;
        const ET = (parseFloat(employmentTenure) / avgEmploymentTenure) * 100;
        const IDU = (parseFloat(dataUsage) / avgDataUsage) * 100;
        const RC = (parseFloat(rationCardValue) / avgRationCardValue) * 100;
        const MB = minBankBalance ? (parseFloat(minBankBalance) / avgMinBankBalance) * 100 : null;
        const C = collateralValue ? (parseFloat(collateralValue) / avgCollateralValue) * 100 : null;

        // Determine which formula to use based on the presence of MB and C
        let score;
        if (MB !== null && C !== null) {
            score = (0.20 * UP) + (0.15 * MR) + (0.20 * ET) + (0.15 * IDU) + (0.20 * RC) + (0.05 * MB) + (0.05 * C);
        } else if (MB === null && C !== null) {
            score = (0.21 * UP) + (0.16 * MR) + (0.21 * ET) + (0.16 * IDU) + (0.21 * RC) + (0.05 * C);
        } else if (MB !== null && C === null) {
            score = (0.21 * UP) + (0.16 * MR) + (0.21 * ET) + (0.16 * IDU) + (0.21 * RC) + (0.05 * MB);
        } else {
            score = (0.22 * UP) + (0.17 * MR) + (0.22 * ET) + (0.17 * IDU) + (0.22 * RC);
        }

        // Round the score to two decimal places
       if (score < 250) {
            score = 250.10;
        } else if (score > 967) {
            score = 967;
        }

        
        score = parseFloat(score.toFixed(2));

        // Check if the user already has a UserInput record
        let userInput = await UserInput.findOne({ userId: req.session.userId });

        if (userInput) {
            // Update existing UserInput record
            userInput.electricityBill = electricityBill;
            userInput.waterBill = waterBill;
            userInput.gasBill = gasBill;
            userInput.mobileRecharge = mobileRecharge;
            userInput.employmentTenure = employmentTenure;
            userInput.dataUsage = dataUsage;
            userInput.rationCardValue = rationCardValue;
            userInput.minBankBalance = minBankBalance;
            userInput.collateralValue = collateralValue;
            userInput.idProof = idProof;
            userInput.idProofContentType = idProofContentType;
            userInput.score = score;

            await userInput.save();
        } else {
            // Create a new UserInput record
            userInput = new UserInput({
                userId: req.session.userId,
                electricityBill,
                waterBill,
                gasBill,
                mobileRecharge,
                employmentTenure,
                dataUsage,
                rationCardValue,
                minBankBalance,
                collateralValue,
                idProof,
                idProofContentType,
                score
            });

            await userInput.save();
        }

        // Update session with the new score
        req.session.userInput = { score };

        // Render the results page with the updated score
        res.render('results', { user: req.session.user, score });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});


// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
