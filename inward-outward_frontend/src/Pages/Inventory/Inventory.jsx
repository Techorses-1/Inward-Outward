import React, { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import html2pdf from "html2pdf.js";
import { FaFileExport, FaSearch, FaFilter, FaChevronDown, FaChevronUp, FaPlus, FaUpload, FaHistory, FaMinus, FaChevronRight, FaCalendarAlt, FaUser, FaRupeeSign } from "react-icons/fa";
import "./Inventory.scss";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from 'xlsx';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showLoader, setShowLoader] = useState(false);
    const loaderTimeoutRef = useRef(null);

    const [stockFilter, setStockFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    // Loading states for buttons
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [isBulkUploading, setIsBulkUploading] = useState(false);

    // Modal states
    const [showAddQtyModal, setShowAddQtyModal] = useState(false);
    const [showRemoveQtyModal, setShowRemoveQtyModal] = useState(false);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
    const [selectedProductDetails, setSelectedProductDetails] = useState(null);
    const [activeHistoryTab, setActiveHistoryTab] = useState('purchase');

    // Add Qty form states
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productSearch, setProductSearch] = useState("");
    const [quantity, setQuantity] = useState("");
    const [purchasePrice, setPurchasePrice] = useState("");
    const [purchaseDate, setPurchaseDate] = useState(new Date());

    // ============================================
    // UPDATED: Remove Qty form states - WITH PRICE
    // ============================================
    const [selectedRemoveProduct, setSelectedRemoveProduct] = useState(null);
    const [removeProductSearch, setRemoveProductSearch] = useState("");
    const [removeQuantity, setRemoveQuantity] = useState("");
    const [removePrice, setRemovePrice] = useState("");                    // NEW - price field
    const [availableQuantity, setAvailableQuantity] = useState(0);
    const [issueDate, setIssueDate] = useState(new Date());
    const [issuedTo, setIssuedTo] = useState("");

    // Bulk upload states
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadErrors, setUploadErrors] = useState([]);
    const [showErrorModal, setShowErrorModal] = useState(false);

    // User access control
    const [userHasInventoryAccess, setUserHasInventoryAccess] = useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);
        checkUserAccess();
        fetchData();
        fetchProducts();
    }, []);

    // Check user access
    const checkUserAccess = () => {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                const restrictedEmails = [
                    "marketing@sfpsons.com",
                    "test@gmail.com"
                ];
                const hasAccess = !restrictedEmails.includes(user.email);
                setUserHasInventoryAccess(hasAccess);
            }
        } catch (error) {
            console.error("Error checking user access:", error);
            setUserHasInventoryAccess(true);
        }
    };

    useEffect(() => {
        if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);

        if (searchTerm.trim()) {
            loaderTimeoutRef.current = setTimeout(() => {
                setShowLoader(true);
            }, 300);

            const searchTimeout = setTimeout(() => {
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setDebouncedSearch(searchTerm.trim().toLowerCase());
                setCurrentPage(1);
                setShowLoader(false);
            }, 300);

            return () => {
                clearTimeout(searchTimeout);
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setShowLoader(false);
            };
        } else {
            setDebouncedSearch("");
            setCurrentPage(1);
            setShowLoader(false);
        }
    }, [searchTerm]);

    const fetchData = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/inventory/get-inventory`);
            if (response.data.success) {
                setInventory(Array.isArray(response.data.data) ? response.data.data : []);
            } else {
                setError(response.data.message || "Failed to load inventory data");
            }
            setLoading(false);
        } catch (error) {
            console.error("Error fetching inventory:", error);
            setError("Failed to load inventory data");
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/products/get-products`);
            if (Array.isArray(response.data)) {
                setProducts(response.data);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    // Filter inventory
    const filteredInventory = useMemo(() => {
        let result = inventory;

        if (stockFilter === "low") {
            result = result.filter(item => item.status === "Low Stock");
        } else if (stockFilter === "out") {
            result = result.filter(item => item.status === "Out of Stock");
        }

        if (debouncedSearch) {
            result = result.filter(item => {
                if (item.productName?.toLowerCase().includes(debouncedSearch)) return true;
                if (item.hsnCode?.toLowerCase().includes(debouncedSearch)) return true;
                if (item.status?.toLowerCase().includes(debouncedSearch)) return true;
                if (item.units?.toLowerCase().includes(debouncedSearch)) return true;
                return false;
            });
        }

        return result;
    }, [debouncedSearch, inventory, stockFilter]);

    // Paginated inventory
    const paginatedInventory = useMemo(() => {
        if (debouncedSearch) return filteredInventory;
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredInventory.slice(0, startIndex + itemsPerPage);
    }, [filteredInventory, currentPage, itemsPerPage, debouncedSearch]);

    const hasMoreInventory = useMemo(() => {
        return debouncedSearch ? false : currentPage * itemsPerPage < filteredInventory.length;
    }, [currentPage, itemsPerPage, filteredInventory.length, debouncedSearch]);

    const loadMoreInventory = () => {
        setCurrentPage(prev => prev + 1);
    };

    // Handle row click - open modal with product details
    const handleRowClick = (item) => {
        setSelectedProductDetails(item);
        setActiveHistoryTab('purchase');
        setShowProductDetailsModal(true);
    };

    // ============================================
    // UPDATED: Export Functions - WITH OUTWARD PRICE
    // ============================================
    const exportToExcel = () => {
        try {
            const exportData = filteredInventory.map(item => ({
                'Product Name': item.productName,
                'HSN Code': item.hsnCode || '-',
                'Avg. Purchase Price': `₹${item.averagePrice?.toFixed(2) || "0.00"}`,
                'Avg. Selling Price': `₹${item.averageSellingPrice?.toFixed(2) || "0.00"}`,    // NEW
                'Total Quantity': item.totalQuantity,
                'Units': item.units,
                'Min. Qty': item.minimumQty,
                'Status': item.status,
                'Total Sales Value': `₹${item.totalOutwardValue?.toFixed(2) || "0.00"}`        // NEW
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `inventory_export_${timestamp}.xlsx`;

            XLSX.writeFile(workbook, filename);
            toast.success("Inventory exported successfully!");
        } catch (error) {
            console.error("Error exporting to Excel:", error);
            toast.error("Failed to export inventory");
        }
    };

    // ============================================
    // FIXED: Export With History - WITH SAFE CHECKS
    // ============================================
    const exportWithHistory = () => {
        try {
            const exportData = [];

            filteredInventory.forEach(item => {
                // SAFE CHECKS for new fields
                const avgSellingPrice = item.averageSellingPrice ? item.averageSellingPrice : 0;
                const totalOutwardValue = item.totalOutwardValue ? item.totalOutwardValue : 0;

                // Add main product row
                exportData.push({
                    'Product Name': item.productName,
                    'HSN Code': item.hsnCode || '-',
                    'Units': item.units,
                    'Min. Qty': item.minimumQty,
                    'Current Quantity': item.totalQuantity,
                    'Avg. Purchase Price': `₹${item.averagePrice?.toFixed(2) || "0.00"}`,
                    'Avg. Selling Price': `₹${avgSellingPrice.toFixed(2)}`,  // FIXED: with fallback
                    'Total Sales Value': `₹${totalOutwardValue.toFixed(2)}`,  // FIXED: with fallback
                    'Status': item.status,
                    'Movement Type': 'PRODUCT INFO',
                    'Date': '-',
                    'Purchase Date': '-',
                    'Issue Date': '-',
                    'Issued To': '-',
                    'Quantity': '-',
                    'Purchase Price': '-',
                    'Selling Price': '-',
                    'Transaction Value': '-'
                });

                // Add purchase history rows
                if (item.priceHistory && item.priceHistory.length > 0) {
                    item.priceHistory.forEach(history => {
                        exportData.push({
                            'Product Name': '',
                            'HSN Code': '',
                            'Units': '',
                            'Min. Qty': '',
                            'Current Quantity': '',
                            'Avg. Purchase Price': '',
                            'Avg. Selling Price': '',
                            'Total Sales Value': '',
                            'Status': '',
                            'Movement Type': 'PURCHASE (INWARD)',
                            'Date': new Date(history.addedAt).toLocaleDateString('en-GB'),
                            'Purchase Date': history.purchaseDate ? new Date(history.purchaseDate).toLocaleDateString('en-GB') : '-',
                            'Issue Date': '-',
                            'Issued To': '-',
                            'Quantity': `+${history.quantityAdded}`,
                            'Purchase Price': `₹${history.price?.toFixed(2) || "0.00"}`,  // FIXED: with optional chaining
                            'Selling Price': '-',
                            'Transaction Value': `₹${(history.price * history.quantityAdded).toFixed(2)}`
                        });
                    });
                }

                // Outward history rows - WITH PRICE
                if (item.outwardHistory && item.outwardHistory.length > 0) {
                    item.outwardHistory.forEach(history => {
                        // SAFE CHECK for price in outward history
                        const price = history.price || 0;

                        exportData.push({
                            'Product Name': '',
                            'HSN Code': '',
                            'Units': '',
                            'Min. Qty': '',
                            'Current Quantity': '',
                            'Avg. Purchase Price': '',
                            'Avg. Selling Price': '',
                            'Total Sales Value': '',
                            'Status': '',
                            'Movement Type': 'OUTWARD (SALE)',
                            'Date': new Date(history.outwardDate).toLocaleDateString('en-GB'),
                            'Purchase Date': '-',
                            'Issue Date': history.issueDate ? new Date(history.issueDate).toLocaleDateString('en-GB') : '-',
                            'Issued To': history.issuedTo || '-',
                            'Quantity': `-${history.quantity}`,
                            'Purchase Price': '-',
                            'Selling Price': `₹${price.toFixed(2)}`,  // FIXED: with fallback
                            'Transaction Value': `₹${(price * history.quantity).toFixed(2)}`  // FIXED: with fallback
                        });
                    });
                }
            });

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory with History');

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `inventory_complete_history_${timestamp}.xlsx`;

            XLSX.writeFile(workbook, filename);
            toast.success("Inventory with complete history exported successfully!");
        } catch (error) {
            console.error("Error exporting with history:", error);
            toast.error("Failed to export inventory with history: " + error.message);
        }
    };

    // Protected modal open functions
    const handleAddQtyClick = () => {
        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to add quantity");
            return;
        }
        setShowAddQtyModal(true);
        resetAddQtyForm();
    };

    const handleRemoveQtyClick = () => {
        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to remove quantity");
            return;
        }
        setShowRemoveQtyModal(true);
        resetRemoveQtyForm();
    };

    const handleBulkUploadClick = () => {
        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to bulk upload");
            return;
        }
        setShowBulkUploadModal(true);
        setUploadFile(null);
        setUploadErrors([]);
    };

    // Add Qty Form Functions
    const resetAddQtyForm = () => {
        setSelectedProduct(null);
        setProductSearch("");
        setQuantity("");
        setPurchasePrice("");
        setPurchaseDate(new Date());
    };

    const handleAddQtySubmit = async (e) => {
        e.preventDefault();

        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to perform this action");
            return;
        }

        if (!selectedProduct) {
            toast.error("Please select a product");
            return;
        }

        if (!quantity || quantity <= 0) {
            toast.error("Please enter a valid quantity (greater than 0)");
            return;
        }

        if (!purchasePrice || purchasePrice <= 0) {
            toast.error("Please enter a valid purchase price (greater than 0)");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/inventory/add-quantity`, {
                productId: selectedProduct.productId,
                quantity: parseInt(quantity),
                price: parseFloat(purchasePrice),
                purchaseDate: purchaseDate
            });

            if (response.data.success) {
                toast.success(response.data.message || "Quantity added successfully!");
                setShowAddQtyModal(false);
                resetAddQtyForm();
                fetchData();
            } else {
                toast.error(response.data.message || "Failed to add quantity");
            }
        } catch (error) {
            console.error("Error adding quantity:", error);

            if (error.response?.data?.message) {
                toast.error("❌ " + error.response.data.message);
            } else {
                toast.error("❌ Failed to add quantity: " + (error.message || "Unknown error"));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============================================
    // UPDATED: Remove Qty Form Functions - WITH PRICE
    // ============================================
    const resetRemoveQtyForm = () => {
        setSelectedRemoveProduct(null);
        setRemoveProductSearch("");
        setRemoveQuantity("");
        setRemovePrice("");                 // NEW - reset price
        setAvailableQuantity(0);
        setIssueDate(new Date());
        setIssuedTo("");
    };

    const handleRemoveProductSelect = (product) => {
        setSelectedRemoveProduct(product);
        setRemoveProductSearch("");

        const inventoryItem = inventory.find(item => item.productId === product.productId);
        setAvailableQuantity(inventoryItem?.totalQuantity || 0);
    };

    // ============================================
    // UPDATED: Remove Qty Submit - WITH PRICE
    // ============================================
    const handleRemoveQtySubmit = async (e) => {
        e.preventDefault();

        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to perform this action");
            return;
        }

        if (!selectedRemoveProduct) {
            toast.error("Please select a product");
            return;
        }

        if (!removeQuantity || removeQuantity <= 0) {
            toast.error("Please enter a valid quantity (greater than 0)");
            return;
        }

        // NEW - Price validation
        if (!removePrice || removePrice <= 0) {
            toast.error("Please enter a valid selling price (greater than 0)");
            return;
        }

        if (parseInt(removeQuantity) > availableQuantity) {
            toast.error(`Cannot remove more than available quantity (${availableQuantity} ${selectedRemoveProduct.units})`);
            return;
        }

        if (!issuedTo || issuedTo.trim() === "") {
            toast.error("Please enter the name of person taking the goods");
            return;
        }

        setIsRemoving(true);

        try {
            // ============================================
            // UPDATED: API call with price
            // ============================================
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/inventory/outward-quantity`, {
                productId: selectedRemoveProduct.productId,
                quantity: parseInt(removeQuantity),
                price: parseFloat(removePrice),              // NEW - send price
                issueDate: issueDate,
                issuedTo: issuedTo.trim()
            });

            if (response.data.success) {
                toast.success(response.data.message || "Quantity removed successfully!");
                setShowRemoveQtyModal(false);
                resetRemoveQtyForm();
                fetchData();
            } else {
                toast.error(response.data.message || "Failed to remove quantity");
            }
        } catch (error) {
            console.error("Error removing quantity:", error);

            if (error.response?.data?.message) {
                toast.error("❌ " + error.response.data.message);
            } else {
                toast.error("❌ Failed to remove quantity: " + (error.message || "Unknown error"));
            }
        } finally {
            setIsRemoving(false);
        }
    };

    // Bulk Upload Functions
    const handleBulkUpload = async (e) => {
        e.preventDefault();

        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to perform this action");
            return;
        }

        if (!uploadFile) {
            toast.error("Please select a file");
            return;
        }

        const formData = new FormData();
        formData.append("file", uploadFile);

        setIsBulkUploading(true);
        setUploadErrors([]);

        try {
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/inventory/bulk-upload-quantities`,
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data"
                    }
                }
            );

            if (response.data.success) {
                if (response.data.summary?.successful > 0) {
                    toast.success(`Successfully added ${response.data.summary.successful} products!`);
                }

                if (response.data.errors && response.data.errors.length > 0) {
                    setUploadErrors(response.data.errors);
                    setShowErrorModal(true);

                    if (response.data.summary?.successful === 0) {
                        toast.error("Upload failed. No products were added.");
                    } else {
                        toast.warning("Upload completed with some errors. Please check the error report.");
                    }
                } else {
                    toast.success("All quantities uploaded successfully!");
                    setShowBulkUploadModal(false);
                    setUploadFile(null);
                }

                fetchData();
            }
        } catch (error) {
            console.error("Error in bulk upload:", error);

            if (error.response?.data?.errors) {
                setUploadErrors(error.response.data.errors);
                setShowErrorModal(true);
                toast.error("Upload failed with errors. Please check the error report.");
            } else {
                toast.error(error.response?.data?.message || "Failed to upload file");
            }
        } finally {
            setIsBulkUploading(false);
        }
    };

    const downloadErrorReport = () => {
        try {
            const errorData = [
                ['Row', 'Product Name', 'Error Reason', 'Details']
            ];

            uploadErrors.forEach((error, index) => {
                errorData.push([
                    error.rowNumber || index + 1,
                    error.productName || 'N/A',
                    error.message || error.reason || 'Unknown error',
                    error.details || ''
                ]);
            });

            let csvContent = "data:text/csv;charset=utf-8,";
            errorData.forEach(row => {
                csvContent += row.map(field => `"${field}"`).join(",") + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `upload-errors-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.info("Error report downloaded successfully!");
        } catch (error) {
            console.error("Error downloading error report:", error);
            toast.error("Failed to download error report");
        }
    };

    const downloadTemplate = () => {
        try {
            const templateData = [
                ['Product Name', 'Quantity', 'Price', 'Purchase Date'],
                ['Example Product 1', '100', '50.00', new Date().toLocaleDateString('en-CA')],
                ['Example Product 2', '50', '75.50', new Date().toLocaleDateString('en-CA')],
                ['Example Product 3', '200', '100.00', new Date().toLocaleDateString('en-CA')]
            ];

            const worksheet = XLSX.utils.aoa_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

            XLSX.writeFile(workbook, 'quantity-upload-template.xlsx');
            toast.info("Template downloaded successfully! Use YYYY-MM-DD format for dates.");
        } catch (error) {
            console.error("Error downloading template:", error);

            // Fallback to CSV
            const templateData = [
                ['Product Name', 'Quantity', 'Price', 'Purchase Date'],
                ['Example Product 1', '100', '50.00', new Date().toLocaleDateString('en-CA')],
                ['Example Product 2', '50', '75.50', new Date().toLocaleDateString('en-CA')]
            ];

            let csvContent = "data:text/csv;charset=utf-8,";
            templateData.forEach(row => {
                csvContent += row.join(",") + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "quantity-upload-template.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.info("CSV Template downloaded successfully! Use YYYY-MM-DD format for dates.");
        }
    };

    // Filter products for searchable dropdowns
    const filteredProducts = useMemo(() => {
        if (!productSearch) return products;
        return products.filter(product =>
            product.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
            product.productId.toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [products, productSearch]);

    const filteredRemoveProducts = useMemo(() => {
        if (!removeProductSearch) return products;
        return products.filter(product =>
            product.productName.toLowerCase().includes(removeProductSearch.toLowerCase()) ||
            product.productId.toLowerCase().includes(removeProductSearch.toLowerCase())
        );
    }, [products, removeProductSearch]);

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setProductSearch("");
    };

    const handleExport = () => {
        const element = document.createElement("div");
        element.style.fontFamily = "Arial, sans-serif";
        element.style.padding = "20px";

        const title = document.createElement("h2");
        title.textContent = "Inventory Report";
        title.style.textAlign = "center";
        title.style.color = "#3f3f91";
        title.style.marginBottom = "20px";
        element.appendChild(title);

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.border = "1px solid #ddd";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.style.backgroundColor = "#f5f6fa";

        ["Product Name", "HSN Code", "Avg. Price", "Total Quantity", "Units", "Min. Qty", "Status"].forEach(headerText => {
            const th = document.createElement("th");
            th.textContent = headerText;
            th.style.padding = "10px";
            th.style.border = "1px solid #ddd";
            th.style.fontWeight = "bold";
            th.style.color = "#3f3f91";
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        filteredInventory.forEach(item => {
            const row = document.createElement("tr");
            [
                item.productName,
                item.hsnCode || "-",
                `₹${item.averagePrice?.toFixed(2) || "0.00"}`,
                item.totalQuantity,
                item.units,
                item.minimumQty,
                item.status
            ].forEach(cellText => {
                const td = document.createElement("td");
                td.textContent = cellText;
                td.style.padding = "8px";
                td.style.border = "1px solid #ddd";

                if (cellText === "Low Stock") {
                    td.style.color = "#d32f2f";
                    td.style.fontWeight = "500";
                } else if (cellText === "Out of Stock") {
                    td.style.color = "#f44336";
                } else if (cellText === "In Stock") {
                    td.style.color = "#388e3c";
                }

                row.appendChild(td);
            });
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        element.appendChild(table);

        const filterInfo = document.createElement("p");
        filterInfo.textContent = `Filters applied: ${stockFilter !== "all" ? `Stock: ${stockFilter === "low" ? "Low Stock" : "Out of Stock"}` : "All Stock"}${debouncedSearch ? `, Search: "${debouncedSearch}"` : ""}`;
        filterInfo.style.marginTop = "15px";
        filterInfo.style.fontSize = "12px";
        filterInfo.style.color = "#666";
        element.appendChild(filterInfo);

        const exportDate = document.createElement("p");
        exportDate.textContent = `Exported on: ${new Date().toLocaleString()}`;
        exportDate.style.marginTop = "5px";
        exportDate.style.fontSize = "12px";
        exportDate.style.color = "#666";
        element.appendChild(exportDate);

        html2pdf().from(element).set({
            margin: 10,
            filename: "Inventory_Report.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
        }).save();
    };

    if (error) {
        return (
            <Navbar>
                <div className="inventory-page">
                    <div className="error-message">{error}</div>
                </div>
            </Navbar>
        );
    }

    return (
        <Navbar>
            <ToastContainer
                position="top-center"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />

            <div className="inventory-page">
                <div className="page-header">
                    <div className="right-section inventory-header-right">
                        <div className="filter-container">
                            <div className="filter-with-icon">
                                <FaFilter className="filter-icon" />
                                <select
                                    value={stockFilter}
                                    onChange={(e) => setStockFilter(e.target.value)}
                                    className="stock-filter"
                                >
                                    <option value="all">All Stock</option>
                                    <option value="low">Low Stock</option>
                                    <option value="out">Out of Stock</option>
                                </select>
                            </div>
                        </div>

                        <div className="search-container">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search inventory..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="action-buttons-group">
                            {userHasInventoryAccess ? (
                                <>
                                    <button
                                        className="add-qty-btn"
                                        onClick={handleAddQtyClick}
                                        disabled={isSubmitting || isRemoving}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <span className="button-loader"></span>
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <FaPlus /> Add Qty
                                            </>
                                        )}
                                    </button>

                                    <button
                                        className="remove-qty-btn"
                                        onClick={handleRemoveQtyClick}
                                        disabled={isSubmitting || isRemoving}
                                    >
                                        {isRemoving ? (
                                            <>
                                                <span className="button-loader"></span>
                                                Removing...
                                            </>
                                        ) : (
                                            <>
                                                <FaMinus /> Remove Qty
                                            </>
                                        )}
                                    </button>

                                    <button
                                        className="bulk-upload-btn"
                                        onClick={handleBulkUploadClick}
                                        disabled={isBulkUploading}
                                    >
                                        {isBulkUploading ? (
                                            <>
                                                <span className="button-loader"></span>
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <FaUpload /> Bulk Upload
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="add-qty-btn disabled-btn"
                                        disabled
                                        title="Inventory modifications restricted for your account"
                                    >
                                        <FaPlus /> Add Qty
                                    </button>
                                    <button
                                        className="remove-qty-btn disabled-btn"
                                        disabled
                                        title="Inventory modifications restricted for your account"
                                    >
                                        <FaMinus /> Remove Qty
                                    </button>
                                    <button
                                        className="bulk-upload-btn disabled-btn"
                                        disabled
                                        title="Inventory modifications restricted for your account"
                                    >
                                        <FaUpload /> Bulk Upload
                                    </button>
                                </>
                            )}

                            <button className="export-btn" onClick={exportToExcel}>
                                <FaFileExport /> Export
                            </button>
                            <button className="export-with-history-btn" onClick={exportWithHistory}>
                                <FaHistory /> Export with History
                            </button>
                        </div>
                    </div>
                </div>

                <div className="data-table" id="inventory-table">
                    {loading ? (
                        <div className="loading">Loading inventory...</div>
                    ) : inventory.length === 0 ? (
                        <div className="no-data">No inventory items found</div>
                    ) : (
                        <>
                            <table>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Product Name</th>
                                        <th>HSN Code</th>
                                        <th>Avg. Purchase Price</th>
                                        <th>Avg. Selling Price</th>      {/* NEW */}
                                        <th>Total Quantity</th>
                                        <th>Units</th>
                                        <th>Min. Qty</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {showLoader ? (
                                        <tr>
                                            <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                                                <div className="table-loader"></div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedInventory.map((item, index) => (
                                            <React.Fragment key={item.inventoryId}>
                                                <tr
                                                    className="clickable-row"
                                                    onClick={() => handleRowClick(item)}
                                                >
                                                    <td className="expand-icon">
                                                        <FaChevronRight />
                                                    </td>
                                                    <td>{item.productName}</td>
                                                    <td>{item.hsnCode || "-"}</td>
                                                    <td>₹{item.averagePrice?.toFixed(2) || "0.00"}</td>
                                                    <td>₹{item.averageSellingPrice?.toFixed(2) || "0.00"}</td>  {/* NEW */}
                                                    <td>{item.totalQuantity}</td>
                                                    <td>{item.units}</td>
                                                    <td>{item.minimumQty}</td>
                                                    <td className={
                                                        item.status === "Out of Stock" ? "out-of-stock" :
                                                            item.status === "Low Stock" ? "low-stock" : "in-stock"
                                                    }>
                                                        {item.status}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="history-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedProductDetails(item);
                                                                setActiveHistoryTab('purchase');
                                                                setShowProductDetailsModal(true);
                                                            }}
                                                            title="View History"
                                                        >
                                                            <FaHistory />
                                                        </button>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {hasMoreInventory && (
                                <div className="load-more-container">
                                    <button onClick={loadMoreInventory} className="load-more-btn">
                                        Load More
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Add Quantity Modal */}
                {showAddQtyModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Add Quantity to Product</h3>
                                <button onClick={() => { setShowAddQtyModal(false); resetAddQtyForm(); }} className="close-btn">×</button>
                            </div>

                            <form onSubmit={handleAddQtySubmit}>
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Search Product *</label>
                                        <div className="searchable-dropdown">
                                            <input
                                                type="text"
                                                placeholder="Type product name..."
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                onFocus={() => setProductSearch("")}
                                            />
                                            {productSearch && (
                                                <div className="dropdown-options">
                                                    {filteredProducts.map(product => (
                                                        <div
                                                            key={product.productId}
                                                            className="dropdown-option"
                                                            onClick={() => handleProductSelect(product)}
                                                        >
                                                            {product.productName}
                                                            <small style={{ marginLeft: '8px', color: '#666' }}>
                                                                (Min: {product.minimumQty} {product.units})
                                                            </small>
                                                        </div>
                                                    ))}
                                                    {filteredProducts.length === 0 && (
                                                        <div className="dropdown-option no-results">
                                                            No products found
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ width: '200px' }}>
                                        <label>
                                            <FaCalendarAlt style={{ marginRight: '5px' }} />
                                            Purchase Date *
                                        </label>
                                        <DatePicker
                                            selected={purchaseDate}
                                            onChange={(date) => setPurchaseDate(date)}
                                            dateFormat="dd/MM/yyyy"
                                            maxDate={new Date()}
                                            className="date-picker-input"
                                            placeholderText="Select date"
                                            required
                                        />
                                    </div>
                                </div>

                                {selectedProduct && (
                                    <div className="product-info">
                                        <p><strong>Product:</strong> {selectedProduct.productName}</p>
                                        <p><strong>HSN:</strong> {selectedProduct.hsnCode || "-"}</p>
                                        <p><strong>Units:</strong> {selectedProduct.units}</p>
                                        <p><strong>Min. Qty:</strong> {selectedProduct.minimumQty}</p>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Quantity to Add *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder={`Enter quantity in ${selectedProduct?.units || 'units'}`}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Purchase Price per Unit (₹) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={purchasePrice}
                                        onChange={(e) => setPurchasePrice(e.target.value)}
                                        placeholder="Enter purchase price per unit"
                                        required
                                    />
                                    <small className="field-note">This price will be recorded in purchase history</small>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" onClick={() => { setShowAddQtyModal(false); resetAddQtyForm(); }} className="cancel-btn">
                                        Cancel
                                    </button>
                                    <button type="submit" className="submit-btn" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <span className="button-loader"></span>
                                                Adding...
                                            </>
                                        ) : (
                                            "Add Quantity"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ============================================ */}
                {/* UPDATED REMOVE QUANTITY MODAL - WITH PRICE FIELD */}
                {/* ============================================ */}
                {showRemoveQtyModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Remove Quantity from Inventory</h3>
                                <button onClick={() => { setShowRemoveQtyModal(false); resetRemoveQtyForm(); }} className="close-btn">×</button>
                            </div>

                            <form onSubmit={handleRemoveQtySubmit}>
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Search Product *</label>
                                        <div className="searchable-dropdown">
                                            <input
                                                type="text"
                                                placeholder="Type product name..."
                                                value={removeProductSearch}
                                                onChange={(e) => setRemoveProductSearch(e.target.value)}
                                                onFocus={() => setRemoveProductSearch("")}
                                            />
                                            {removeProductSearch && (
                                                <div className="dropdown-options">
                                                    {filteredRemoveProducts.map(product => {
                                                        const inventoryItem = inventory.find(item => item.productId === product.productId);
                                                        const available = inventoryItem?.totalQuantity || 0;
                                                        return (
                                                            <div
                                                                key={product.productId}
                                                                className="dropdown-option"
                                                                onClick={() => handleRemoveProductSelect(product)}
                                                            >
                                                                {product.productName}
                                                                <span className={`available-badge ${available > 0 ? 'available' : 'unavailable'}`}>
                                                                    {available} {product.units} available
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                    {filteredRemoveProducts.length === 0 && (
                                                        <div className="dropdown-option no-results">
                                                            No products found
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ width: '200px' }}>
                                        <label>
                                            <FaCalendarAlt style={{ marginRight: '5px' }} />
                                            Issue Date *
                                        </label>
                                        <DatePicker
                                            selected={issueDate}
                                            onChange={(date) => setIssueDate(date)}
                                            dateFormat="dd/MM/yyyy"
                                            maxDate={new Date()}
                                            className="date-picker-input"
                                            placeholderText="Select date"
                                            required
                                        />
                                    </div>
                                </div>

                                {selectedRemoveProduct && (
                                    <div className="product-info">
                                        <p><strong>Product:</strong> {selectedRemoveProduct.productName}</p>
                                        <p><strong>HSN:</strong> {selectedRemoveProduct.hsnCode || "-"}</p>
                                        <p><strong>Units:</strong> {selectedRemoveProduct.units}</p>
                                        <p><strong>Available Quantity:</strong>
                                            <span style={{
                                                color: availableQuantity > 0 ? '#388e3c' : '#f44336',
                                                fontWeight: 'bold',
                                                marginLeft: '8px'
                                            }}>
                                                {availableQuantity} {selectedRemoveProduct.units}
                                            </span>
                                        </p>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Quantity to Remove *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={availableQuantity}
                                        step="1"
                                        value={removeQuantity}
                                        onChange={(e) => setRemoveQuantity(e.target.value)}
                                        placeholder={`Enter quantity to remove (max: ${availableQuantity})`}
                                        required
                                    />
                                    {removeQuantity && parseInt(removeQuantity) > availableQuantity && (
                                        <small className="error-message">
                                            Cannot remove more than available quantity!
                                        </small>
                                    )}
                                </div>

                                {/* ============================================ */}
                                {/* NEW - PRICE FIELD FOR OUTWARD */}
                                {/* ============================================ */}
                                <div className="form-group">
                                    <label>
                                        <FaRupeeSign style={{ marginRight: '5px' }} />
                                        Selling Price per Unit (₹) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={removePrice}
                                        onChange={(e) => setRemovePrice(e.target.value)}
                                        placeholder="Enter selling price per unit"
                                        required
                                    />
                                    {removePrice && removeQuantity && (
                                        <small className="field-note" style={{ color: '#3f3f91', fontWeight: '500' }}>
                                            Total Value: ₹{(parseFloat(removePrice) * parseInt(removeQuantity)).toFixed(2)}
                                        </small>
                                    )}
                                    <small className="field-note">This price will be recorded in outward history</small>
                                </div>

                                <div className="form-group">
                                    <label>
                                        <FaUser style={{ marginRight: '5px' }} />
                                        Issued To (Person Name) *
                                    </label>
                                    <input
                                        type="text"
                                        value={issuedTo}
                                        onChange={(e) => setIssuedTo(e.target.value)}
                                        placeholder="Enter name of person taking goods"
                                        required
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" onClick={() => { setShowRemoveQtyModal(false); resetRemoveQtyForm(); }} className="cancel-btn">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="submit-btn"
                                        disabled={isRemoving || (removeQuantity && parseInt(removeQuantity) > availableQuantity)}
                                    >
                                        {isRemoving ? (
                                            <>
                                                <span className="button-loader"></span>
                                                Removing...
                                            </>
                                        ) : (
                                            "Remove Quantity"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ============================================ */}
                {/* UPDATED PRODUCT DETAILS MODAL - WITH OUTWARD PRICE */}
                {/* ============================================ */}
                {showProductDetailsModal && selectedProductDetails && (
                    <div className="modal-overlay">
                        <div className="modal-content details-modal">
                            <div className="modal-header">
                                <h3>{selectedProductDetails.productName}</h3>
                                <button onClick={() => setShowProductDetailsModal(false)} className="close-btn">×</button>
                            </div>

                            <div className="product-summary">
                                <div className="summary-grid">
                                    <div className="summary-item">
                                        <label>HSN Code:</label>
                                        <span>{selectedProductDetails.hsnCode || '-'}</span>
                                    </div>
                                    <div className="summary-item">
                                        <label>Units:</label>
                                        <span>{selectedProductDetails.units}</span>
                                    </div>
                                    <div className="summary-item">
                                        <label>Min. Quantity:</label>
                                        <span>{selectedProductDetails.minimumQty}</span>
                                    </div>
                                    <div className="summary-item">
                                        <label>Current Stock:</label>
                                        <span className={selectedProductDetails.status === "Low Stock" ? "low-stock" :
                                            selectedProductDetails.status === "Out of Stock" ? "out-of-stock" : "in-stock"}>
                                            {selectedProductDetails.totalQuantity} {selectedProductDetails.units}
                                        </span>
                                    </div>
                                    <div className="summary-item">
                                        <label>Avg. Purchase Price:</label>
                                        <span>₹{selectedProductDetails.averagePrice?.toFixed(2) || "0.00"}</span>
                                    </div>
                                    {/* NEW - Average Selling Price */}
                                    <div className="summary-item">
                                        <label>Avg. Selling Price:</label>
                                        <span>₹{selectedProductDetails.averageSellingPrice?.toFixed(2) || "0.00"}</span>
                                    </div>
                                    {/* NEW - Total Sales Value */}
                                    <div className="summary-item">
                                        <label>Total Sales Value:</label>
                                        <span>₹{selectedProductDetails.totalOutwardValue?.toFixed(2) || "0.00"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Toggle Buttons */}
                            <div className="history-toggle">
                                <button
                                    className={`toggle-btn ${activeHistoryTab === 'purchase' ? 'active' : ''}`}
                                    onClick={() => setActiveHistoryTab('purchase')}
                                >
                                    Purchase History
                                </button>
                                <button
                                    className={`toggle-btn ${activeHistoryTab === 'outward' ? 'active' : ''}`}
                                    onClick={() => setActiveHistoryTab('outward')}
                                >
                                    Outward History
                                </button>
                            </div>

                            {/* Purchase History Tab */}
                            {activeHistoryTab === 'purchase' && (
                                <div className="history-content">
                                    <h4>Purchase History</h4>
                                    {selectedProductDetails.priceHistory && selectedProductDetails.priceHistory.length > 0 ? (
                                        <table className="history-table">
                                            <thead>
                                                <tr>
                                                    <th>Purchase Date</th>
                                                    <th>System Date</th>
                                                    <th>Quantity Added</th>
                                                    <th>Price per Unit</th>
                                                    <th>Total Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedProductDetails.priceHistory.map((history, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            <strong>
                                                                {history.purchaseDate ?
                                                                    new Date(history.purchaseDate).toLocaleDateString() :
                                                                    new Date(history.addedAt).toLocaleDateString()}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            <small style={{ color: '#666' }}>
                                                                {new Date(history.addedAt).toLocaleDateString()}
                                                            </small>
                                                        </td>
                                                        <td><span className="positive">+{history.quantityAdded} {selectedProductDetails.units}</span></td>
                                                        <td>₹{history.price.toFixed(2)}</td>
                                                        <td>₹{(history.price * history.quantityAdded).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                        Total Purchases:
                                                    </td>
                                                    <td style={{ fontWeight: 'bold', color: '#3f3f91' }}>
                                                        ₹{selectedProductDetails.priceHistory.reduce((sum, h) => sum + (h.price * h.quantityAdded), 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    ) : (
                                        <div className="no-history">No purchase history available</div>
                                    )}
                                </div>
                            )}

                            {/* ============================================ */}
                            {/* UPDATED: Outward History Tab - WITH PRICE */}
                            {/* ============================================ */}
                            {activeHistoryTab === 'outward' && (
                                <div className="history-content">
                                    <h4>Outward History</h4>
                                    {selectedProductDetails.outwardHistory && selectedProductDetails.outwardHistory.length > 0 ? (
                                        <table className="history-table">
                                            <thead>
                                                <tr>
                                                    <th>Issue Date</th>
                                                    <th>System Date</th>
                                                    <th>Issued To</th>
                                                    <th>Quantity Removed</th>
                                                    <th>Selling Price</th>        {/* NEW */}
                                                    <th>Total Value</th>           {/* NEW */}
                                                    <th>Remaining Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedProductDetails.outwardHistory.map((history, index) => {
                                                    const totalRemovedUpToIndex = selectedProductDetails.outwardHistory
                                                        .slice(0, index + 1)
                                                        .reduce((sum, h) => sum + h.quantity, 0);
                                                    const remainingAtThatTime = selectedProductDetails.totalQuantity +
                                                        (selectedProductDetails.outwardHistory
                                                            .slice(index + 1)
                                                            .reduce((sum, h) => sum + h.quantity, 0));

                                                    return (
                                                        <tr key={index}>
                                                            <td>
                                                                <strong>
                                                                    {history.issueDate ?
                                                                        new Date(history.issueDate).toLocaleDateString() :
                                                                        new Date(history.outwardDate).toLocaleDateString()}
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                <small style={{ color: '#666' }}>
                                                                    {new Date(history.outwardDate).toLocaleDateString()}
                                                                </small>
                                                            </td>
                                                            <td>
                                                                <span className="issued-to-badge">
                                                                    <FaUser style={{ marginRight: '5px' }} />
                                                                    {history.issuedTo || 'N/A'}
                                                                </span>
                                                            </td>
                                                            <td><span className="negative">-{history.quantity} {selectedProductDetails.units}</span></td>
                                                            <td>₹{history.price?.toFixed(2) || '0.00'}</td>                 {/* NEW */}
                                                            <td>₹{(history.price * history.quantity).toFixed(2)}</td>       {/* NEW */}
                                                            <td>{remainingAtThatTime} {selectedProductDetails.units}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                        Total Removed:
                                                    </td>
                                                    <td style={{ fontWeight: 'bold', color: '#f44336' }}>
                                                        {selectedProductDetails.outwardHistory.reduce((sum, h) => sum + h.quantity, 0)} {selectedProductDetails.units}
                                                    </td>
                                                    <td style={{ fontWeight: 'bold', color: '#3f3f91' }}>
                                                        Avg: ₹{selectedProductDetails.averageSellingPrice?.toFixed(2) || '0.00'}
                                                    </td>
                                                    <td style={{ fontWeight: 'bold', color: '#3f3f91' }}>
                                                        ₹{selectedProductDetails.outwardHistory.reduce((sum, h) => sum + (h.price * h.quantity), 0).toFixed(2)}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    ) : (
                                        <div className="no-history">No outward history available</div>
                                    )}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button onClick={() => setShowProductDetailsModal(false)} className="close-history-btn">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bulk Upload Modal */}
                {showBulkUploadModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Bulk Upload Quantities</h3>
                                <button onClick={() => setShowBulkUploadModal(false)} className="close-btn">×</button>
                            </div>

                            <form onSubmit={handleBulkUpload}>
                                <div className="form-group">
                                    <label>Upload Excel File *</label>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        onChange={(e) => setUploadFile(e.target.files[0])}
                                        required
                                    />
                                    <small className="field-note">
                                        File should have columns: <strong>Product Name, Quantity, Price, Purchase Date</strong>
                                    </small>
                                    <small className="field-note" style={{ color: '#f57c00', display: 'block', marginTop: '5px' }}>
                                        Date format: YYYY-MM-DD (e.g., 2024-12-25)
                                    </small>
                                </div>

                                <div className="download-template">
                                    <button
                                        type="button"
                                        onClick={downloadTemplate}
                                        className="template-download-btn"
                                    >
                                        📥 Download Template File (with Date column)
                                    </button>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" onClick={() => setShowBulkUploadModal(false)} className="cancel-btn">
                                        Cancel
                                    </button>
                                    <button type="submit" className="submit-btn" disabled={isBulkUploading}>
                                        {isBulkUploading ? (
                                            <>
                                                <span className="button-loader"></span>
                                                Uploading...
                                            </>
                                        ) : (
                                            "Upload File"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Error Report Modal */}
                {showErrorModal && (
                    <div className="modal-overlay">
                        <div className="modal-content error-report-modal">
                            <div className="modal-header">
                                <h3>Upload Error Report</h3>
                                <button onClick={() => setShowErrorModal(false)} className="close-btn">×</button>
                            </div>

                            <div className="error-report-content">
                                <div className="error-summary">
                                    <p><strong>{uploadErrors.length} errors found during upload:</strong></p>
                                </div>

                                <div className="errors-table-container">
                                    <table className="errors-table">
                                        <thead>
                                            <tr>
                                                <th>Row</th>
                                                <th>Product Name</th>
                                                <th>Error Reason</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uploadErrors.map((error, index) => (
                                                <tr key={index} className="error-row">
                                                    <td className="error-row-number">#{error.rowNumber || index + 1}</td>
                                                    <td className="error-product">{error.productName || "N/A"}</td>
                                                    <td className="error-reason">
                                                        <span className="error-message">{error.message || error.reason}</span>
                                                    </td>
                                                    <td className="error-details">
                                                        <small>{error.details || '-'}</small>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="error-actions">
                                    <button
                                        onClick={downloadErrorReport}
                                        className="download-error-btn"
                                    >
                                        📥 Download Error Report
                                    </button>
                                    <button
                                        onClick={() => setShowErrorModal(false)}
                                        className="close-error-btn"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Navbar>
    );
};

export default Inventory;