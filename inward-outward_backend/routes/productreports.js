const express = require("express");
const router = express.Router();
const Product = require("../models/product");
const Inventory = require("../models/inventory");

// ============================================
// HELPER FUNCTION: Create date range for query (NO TIMEZONE ISSUES)
// ============================================
const createDateRange = (fromDate, toDate) => {
    let startDate, endDate;

    if (fromDate) {
        // Create date from YYYY-MM-DD without timezone conversion
        const [year, month, day] = fromDate.split('-').map(Number);
        startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    } else {
        startDate = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0)); // Jan 1, 1970
    }

    if (toDate) {
        const [year, month, day] = toDate.split('-').map(Number);
        endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    } else {
        const now = new Date();
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    }

    console.log("📅 Original fromDate:", fromDate);
    console.log("📅 Original toDate:", toDate);
    console.log("📅 Converted startDate UTC:", startDate.toISOString());
    console.log("📅 Converted endDate UTC:", endDate.toISOString());

    return { startDate, endDate };
};

// ============================================
// GET REPORTS METRICS (Date Filtered + Always Live) - WITH AVG SELLING PRICE
// ============================================
router.get("/metrics", async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        // Create date range without timezone issues
        const { startDate, endDate } = createDateRange(fromDate, toDate);

        console.log("📊 Fetching metrics from:", startDate.toISOString(), "to:", endDate.toISOString());

        // Get all inventory with products
        const inventory = await Inventory.find({});
        const products = await Product.find({});

        // ===== DATE FILTERED METRICS =====
        let totalInward = 0;
        let totalOutward = 0;
        let totalPurchaseCost = 0;
        let totalPurchaseQuantity = 0;

        // NEW: For selling price calculation
        let totalSellingValue = 0;
        let totalSoldQuantity = 0;

        let productsMovedSet = new Set();

        inventory.forEach(item => {
            // Calculate inward in date range using purchaseDate (fallback to addedAt)
            if (item.priceHistory && item.priceHistory.length > 0) {
                item.priceHistory.forEach(entry => {
                    const entryDate = entry.purchaseDate
                        ? new Date(entry.purchaseDate)
                        : new Date(entry.addedAt);

                    if (entryDate >= startDate && entryDate <= endDate) {
                        totalInward += entry.quantityAdded;
                        totalPurchaseCost += entry.price * entry.quantityAdded;
                        totalPurchaseQuantity += entry.quantityAdded;
                        productsMovedSet.add(item.productId);
                    }
                });
            }

            // Calculate outward in date range using issueDate (fallback to outwardDate)
            // AND calculate selling price
            if (item.outwardHistory && item.outwardHistory.length > 0) {
                item.outwardHistory.forEach(entry => {
                    const entryDate = entry.issueDate
                        ? new Date(entry.issueDate)
                        : new Date(entry.outwardDate);

                    if (entryDate >= startDate && entryDate <= endDate) {
                        totalOutward += entry.quantity;
                        productsMovedSet.add(item.productId);

                        // NEW: Calculate selling price metrics
                        const price = entry.price || 0; // Use 0 if price not available
                        totalSoldQuantity += entry.quantity;
                        totalSellingValue += price * entry.quantity;
                    }
                });
            }
        });

        // Calculate average purchase price
        const avgPurchasePrice = totalPurchaseQuantity > 0
            ? totalPurchaseCost / totalPurchaseQuantity
            : 0;

        // NEW: Calculate average selling price
        const avgSellingPrice = totalSoldQuantity > 0
            ? totalSellingValue / totalSoldQuantity
            : 0;

        // Calculate total inventory value (using average price * current stock)
        let totalInventoryValue = 0;
        inventory.forEach(item => {
            totalInventoryValue += (item.averagePrice || 0) * item.totalQuantity;
        });

        // ===== ALWAYS LIVE METRICS =====
        const totalProducts = products.length;

        let lowStockCount = 0;
        let outOfStockCount = 0;
        const lowStockProducts = [];
        const outOfStockProducts = [];

        inventory.forEach(item => {
            const product = products.find(p => p.productId === item.productId);
            const minQty = product?.minimumQty || 0;

            if (item.totalQuantity === 0) {
                outOfStockCount++;
                outOfStockProducts.push({
                    productId: item.productId,
                    productName: item.productName,
                    units: item.units,
                    minimumQty: minQty,
                    currentStock: item.totalQuantity
                });
            } else if (item.totalQuantity <= minQty) {
                lowStockCount++;
                lowStockProducts.push({
                    productId: item.productId,
                    productName: item.productName,
                    units: item.units,
                    minimumQty: minQty,
                    currentStock: item.totalQuantity
                });
            }
        });

        res.status(200).json({
            success: true,
            data: {
                // Date Filtered Metrics - NOW WITH 5 CARDS
                dateFiltered: {
                    totalInward,
                    totalOutward,
                    avgPurchasePrice: parseFloat(avgPurchasePrice.toFixed(2)),
                    avgSellingPrice: parseFloat(avgSellingPrice.toFixed(2)), // NEW FIELD
                    totalValue: parseFloat(totalInventoryValue.toFixed(2)),
                    productsMoved: productsMovedSet.size
                },
                // Always Live Metrics
                alwaysLive: {
                    totalProducts,
                    lowStock: {
                        count: lowStockCount,
                        products: lowStockProducts
                    },
                    outOfStock: {
                        count: outOfStockCount,
                        products: outOfStockProducts
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error fetching metrics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch metrics",
            error: error.message
        });
    }
});

// ============================================
// GET TOP 5 OUTWARD PRODUCTS (UPDATED - uses issueDate)
// ============================================
router.get("/top-outward", async (req, res) => {
    try {
        const { fromDate, toDate, limit = 5 } = req.query;

        // Create date range without timezone issues
        const { startDate, endDate } = createDateRange(fromDate, toDate);

        console.log("📊 Fetching top outward products from:", startDate.toISOString(), "to:", endDate.toISOString());

        const inventory = await Inventory.find({});

        // Calculate outward per product
        const productOutward = [];

        inventory.forEach(item => {
            let totalOutward = 0;

            if (item.outwardHistory && item.outwardHistory.length > 0) {
                item.outwardHistory.forEach(entry => {
                    // USE issueDate for filtering, fallback to outwardDate
                    const entryDate = entry.issueDate
                        ? new Date(entry.issueDate)
                        : new Date(entry.outwardDate);

                    if (entryDate >= startDate && entryDate <= endDate) {
                        totalOutward += entry.quantity;
                    }
                });
            }

            if (totalOutward > 0) {
                productOutward.push({
                    productId: item.productId,
                    productName: item.productName,
                    units: item.units,
                    totalOutward,
                    currentStock: item.totalQuantity
                });
            }
        });

        // Sort by outward quantity (descending) and take top 'limit'
        const topProducts = productOutward
            .sort((a, b) => b.totalOutward - a.totalOutward)
            .slice(0, parseInt(limit));

        res.status(200).json({
            success: true,
            data: topProducts
        });

    } catch (error) {
        console.error("Error fetching top outward products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch top outward products",
            error: error.message
        });
    }
});

// ============================================
// GET INWARD TRANSACTIONS (UPDATED - uses purchaseDate)
// ============================================
router.get("/inward-transactions", async (req, res) => {
    try {
        const { fromDate, toDate, productId } = req.query;

        // Create date range without timezone issues
        const { startDate, endDate } = createDateRange(fromDate, toDate);

        console.log("📊 Fetching inward transactions from:", startDate.toISOString(), "to:", endDate.toISOString());

        let query = {};
        if (productId) {
            query.productId = productId;
        }

        const inventory = await Inventory.find(query);

        const inwardTransactions = [];

        inventory.forEach(item => {
            if (item.priceHistory && item.priceHistory.length > 0) {
                item.priceHistory.forEach(entry => {
                    // USE purchaseDate for filtering, fallback to addedAt
                    const entryDate = entry.purchaseDate
                        ? new Date(entry.purchaseDate)
                        : new Date(entry.addedAt);

                    if (entryDate >= startDate && entryDate <= endDate) {
                        inwardTransactions.push({
                            transactionId: `${item.productId}_${entryDate.getTime()}`,
                            date: entry.purchaseDate || entry.addedAt, // Show purchaseDate if available
                            systemDate: entry.addedAt, // Keep system date for reference
                            productId: item.productId,
                            productName: item.productName,
                            units: item.units,
                            quantity: entry.quantityAdded,
                            price: entry.price,
                            total: entry.price * entry.quantityAdded,
                            type: 'INWARD'
                        });
                    }
                });
            }
        });

        // Sort by date (newest first) using purchaseDate
        inwardTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            data: inwardTransactions
        });

    } catch (error) {
        console.error("Error fetching inward transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch inward transactions",
            error: error.message
        });
    }
});

// ============================================
// GET OUTWARD TRANSACTIONS - WITH SELLING PRICE
// ============================================
router.get("/outward-transactions", async (req, res) => {
    try {
        const { fromDate, toDate, productId } = req.query;

        // Create date range without timezone issues
        const { startDate, endDate } = createDateRange(fromDate, toDate);

        console.log("📊 Fetching outward transactions from:", startDate.toISOString(), "to:", endDate.toISOString());

        let query = {};
        if (productId) {
            query.productId = productId;
        }

        const inventory = await Inventory.find(query);

        const outwardTransactions = [];

        inventory.forEach(item => {
            if (item.outwardHistory && item.outwardHistory.length > 0) {
                // Calculate running balance (start with current stock + all future outward)
                let runningBalance = item.totalQuantity;
                const futureOutward = item.outwardHistory
                    .filter(entry => {
                        const entryDate = entry.issueDate
                            ? new Date(entry.issueDate)
                            : new Date(entry.outwardDate);
                        return entryDate > endDate;
                    })
                    .reduce((sum, e) => sum + e.quantity, 0);
                runningBalance += futureOutward;

                // Sort outward entries by date (oldest first for running balance) using issueDate
                const sortedOutward = [...item.outwardHistory].sort((a, b) => {
                    const dateA = a.issueDate ? new Date(a.issueDate) : new Date(a.outwardDate);
                    const dateB = b.issueDate ? new Date(b.issueDate) : new Date(b.outwardDate);
                    return dateA - dateB;
                });

                sortedOutward.forEach(entry => {
                    const entryDate = entry.issueDate
                        ? new Date(entry.issueDate)
                        : new Date(entry.outwardDate);

                    if (entryDate >= startDate && entryDate <= endDate) {
                        // NEW: Calculate price and total value (with fallback to 0)
                        const price = entry.price || 0;
                        const totalValue = price * entry.quantity;

                        outwardTransactions.push({
                            transactionId: `${item.productId}_${entryDate.getTime()}`,
                            date: entry.issueDate || entry.outwardDate,
                            systemDate: entry.outwardDate,
                            productId: item.productId,
                            productName: item.productName,
                            units: item.units,
                            quantity: entry.quantity,
                            price: price,                          // NEW FIELD
                            totalValue: totalValue,                // NEW FIELD
                            issuedTo: entry.issuedTo || '-',
                            runningBalance: runningBalance,
                            type: 'OUTWARD'
                        });
                    }
                    // Update running balance for next entry
                    runningBalance -= entry.quantity;
                });
            }
        });

        // Sort by date (newest first) using issueDate
        outwardTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            data: outwardTransactions
        });

    } catch (error) {
        console.error("Error fetching outward transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch outward transactions",
            error: error.message
        });
    }
});

// ============================================
// GET COMBINED REPORT (For Master Export) - WITH SELLING PRICE
// ============================================
router.get("/combined-report", async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        // Create date range without timezone issues
        const { startDate, endDate } = createDateRange(fromDate, toDate);

        console.log("📊 Fetching combined report from:", startDate.toISOString(), "to:", endDate.toISOString());

        const inventory = await Inventory.find({});

        const inwardData = [];
        const outwardData = [];

        inventory.forEach(item => {
            // Inward data - using purchaseDate
            if (item.priceHistory && item.priceHistory.length > 0) {
                item.priceHistory.forEach(entry => {
                    const entryDate = entry.purchaseDate
                        ? new Date(entry.purchaseDate)
                        : new Date(entry.addedAt);

                    if (entryDate >= startDate && entryDate <= endDate) {
                        inwardData.push({
                            date: entry.purchaseDate || entry.addedAt,
                            systemDate: entry.addedAt,
                            productName: item.productName,
                            units: item.units,
                            quantity: entry.quantityAdded,
                            price: entry.price,
                            total: entry.price * entry.quantityAdded,
                            type: 'PURCHASE'
                        });
                    }
                });
            }

            // Outward data - using issueDate - WITH PRICE
            if (item.outwardHistory && item.outwardHistory.length > 0) {
                item.outwardHistory.forEach(entry => {
                    const entryDate = entry.issueDate
                        ? new Date(entry.issueDate)
                        : new Date(entry.outwardDate);

                    if (entryDate >= startDate && entryDate <= endDate) {
                        // NEW: Calculate price and total value (with fallback to 0)
                        const price = entry.price || 0;
                        const totalValue = price * entry.quantity;

                        outwardData.push({
                            date: entry.issueDate || entry.outwardDate,
                            systemDate: entry.outwardDate,
                            productName: item.productName,
                            units: item.units,
                            quantity: entry.quantity,
                            price: price,                          // NEW FIELD
                            totalValue: totalValue,                // NEW FIELD
                            issuedTo: entry.issuedTo || '-',
                            type: 'OUTWARD'
                        });
                    }
                });
            }
        });

        // Sort both by date (newest first)
        inwardData.sort((a, b) => new Date(b.date) - new Date(a.date));
        outwardData.sort((a, b) => new Date(b.date) - new Date(a.date));

        // NEW: Calculate totals including selling price
        const totalSellingValue = outwardData.reduce((sum, item) => sum + (item.totalValue || 0), 0);
        const totalSoldQuantity = outwardData.reduce((sum, item) => sum + item.quantity, 0);

        res.status(200).json({
            success: true,
            data: {
                inward: inwardData,
                outward: outwardData,
                summary: {
                    totalInward: inwardData.reduce((sum, item) => sum + item.quantity, 0),
                    totalOutward: outwardData.reduce((sum, item) => sum + item.quantity, 0),
                    totalInwardValue: inwardData.reduce((sum, item) => sum + (item.total || 0), 0),
                    totalSellingValue: totalSellingValue,           // NEW FIELD
                    avgSellingPrice: totalSoldQuantity > 0
                        ? totalSellingValue / totalSoldQuantity
                        : 0                                         // NEW FIELD
                }
            }
        });

    } catch (error) {
        console.error("Error fetching combined report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch combined report",
            error: error.message
        });
    }
});

// ============================================
// GET LOW STOCK PRODUCTS DETAILS (No change - live data)
// ============================================
router.get("/low-stock", async (req, res) => {
    try {
        const products = await Product.find({});
        const inventory = await Inventory.find({});

        const lowStockItems = [];

        inventory.forEach(item => {
            const product = products.find(p => p.productId === item.productId);
            const minQty = product?.minimumQty || 0;

            if (item.totalQuantity > 0 && item.totalQuantity <= minQty) {
                lowStockItems.push({
                    productId: item.productId,
                    productName: item.productName,
                    units: item.units,
                    minimumQty: minQty,
                    currentStock: item.totalQuantity,
                    status: item.totalQuantity === 0 ? 'Out of Stock' : 'Low Stock'
                });
            }
        });

        res.status(200).json({
            success: true,
            data: lowStockItems
        });

    } catch (error) {
        console.error("Error fetching low stock products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch low stock products",
            error: error.message
        });
    }
});

// ============================================
// GET OUT OF STOCK PRODUCTS DETAILS (No change - live data)
// ============================================
router.get("/out-of-stock", async (req, res) => {
    try {
        const products = await Product.find({});
        const inventory = await Inventory.find({});

        const outOfStockItems = [];

        inventory.forEach(item => {
            if (item.totalQuantity === 0) {
                const product = products.find(p => p.productId === item.productId);
                outOfStockItems.push({
                    productId: item.productId,
                    productName: item.productName,
                    units: item.units,
                    minimumQty: product?.minimumQty || 0,
                    currentStock: 0,
                    status: 'Out of Stock'
                });
            }
        });

        res.status(200).json({
            success: true,
            data: outOfStockItems
        });

    } catch (error) {
        console.error("Error fetching out of stock products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch out of stock products",
            error: error.message
        });
    }
});

module.exports = router;