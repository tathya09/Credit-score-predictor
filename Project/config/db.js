const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://tathyajha01:Shopmo@cluster0.wwerswk.mongodb.net/Credit-score', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.log(err));

module.exports = mongoose;
