const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    unique: true,
    trim: true
  },
  productDescription: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true
  },
  minimumQty: {
    type: Number,
    required: [true, 'Minimum quantity is required'],
    min: [0, 'Minimum quantity cannot be negative'],
    default: 0
  },
  hsnCode: {
    type: String,
    required: [true, 'HSN Code is required'],
    trim: true
  },
  units: {
    type: String,
    required: [true, 'Units is required'],
    enum: {
      values: [
        'NOS',     // numbers / count
        'METERS',  // length
        'KG',      // weight
        'GRAM',    // small weight
        'LITRE',   // liquid
        'ML'       // small liquid
      ],
      message: 'Units must be NOS, METERS, KG, GRAM, LITRE, or ML'
    }
  }
}, {
  timestamps: true,
});

// Create indexes for better query performance
productSchema.index({ productName: 1 });
productSchema.index({ hsnCode: 1 });
productSchema.index({ units: 1 });

// ✅ Use cached model if already compiled
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

module.exports = Product;