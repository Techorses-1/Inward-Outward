import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaCubes,
  FaHashtag,
  FaPlus,
  FaFileExport,
  FaFileExcel,
  FaSearch,
  FaEdit,
  FaSave,
  FaTrash,
  FaUpload,
  FaFileDownload,
  FaAlignLeft,
  FaSortNumericDown,
  FaRulerCombined,
  FaTimes,
  FaExclamationTriangle
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Items.scss";
import "react-toastify/dist/ReactToastify.css";

// Units dropdown options
const UNITS_OPTIONS = [
  { value: "NOS", label: "Nos" },
  { value: "METERS", label: "Meters" },
  { value: "KG", label: "KG" },
  { value: "GRAM", label: "Gram" },
  { value: "LITRE", label: "Litre" },
  { value: "ML", label: "ML" }
];

const Items = () => {
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Bulk upload states
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Updated initial values with new fields
  const initialValues = {
    productName: "",
    productDescription: "",
    minimumQty: "",
    hsnCode: "",
    units: ""
  };

  // Updated validation schema
  const validationSchema = Yup.object({
    productName: Yup.string()
      .required("Product Name is required")
      .max(100, "Product Name cannot exceed 100 characters"),
    productDescription: Yup.string()
      .required("Product Description is required")
      .max(500, "Description cannot exceed 500 characters"),
    minimumQty: Yup.number()
      .required("Minimum Quantity is required")
      .min(0, "Minimum Quantity cannot be negative")
      .typeError("Minimum Quantity must be a number"),
    hsnCode: Yup.string()
      .required("HSN Code is required")
      .matches(/^[0-9]{4,8}$/, "HSN Code must be 4-8 digits"),
    units: Yup.string()
      .required("Units is required")
      .oneOf(UNITS_OPTIONS.map(opt => opt.value), "Invalid unit selected")
  });

  // Fetch items
  useEffect(() => {
    setIsLoading(true);
    axios.get(`${import.meta.env.VITE_API_URL}/products/get-products`)
      .then((res) => {
        const sortedData = res.data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt)
            : (a._id?.getTimestamp ? new Date(a._id.getTimestamp()) : new Date(0));
          const dateB = b.createdAt ? new Date(b.createdAt)
            : (b._id?.getTimestamp ? new Date(b._id.getTimestamp()) : new Date(0));
          return dateB - dateA;
        });
        setItems(sortedData);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching items:", err);
        toast.error("Failed to load items.");
        setIsLoading(false);
      });
  }, []);

  // Filter items by search term
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    return items.filter((item) =>
      item.productName?.toLowerCase().includes(debouncedSearch) ||
      item.productDescription?.toLowerCase().includes(debouncedSearch) ||
      item.hsnCode?.toLowerCase().includes(debouncedSearch) ||
      item.units?.toLowerCase().includes(debouncedSearch) ||
      item.minimumQty?.toString().includes(debouncedSearch)
    );
  }, [debouncedSearch, items]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    if (debouncedSearch) return filteredItems;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(0, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage, debouncedSearch]);

  // Check if there are more items to load
  const hasMoreItems = useMemo(() => {
    return debouncedSearch ? false : currentPage * itemsPerPage < filteredItems.length;
  }, [currentPage, itemsPerPage, filteredItems.length, debouncedSearch]);

  // Load more items
  const loadMoreItems = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Navigation guard
  const handleNavigation = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  // Handle form submission
  const handleSubmit = async (values, { resetForm, setFieldError }) => {
    setIsSubmitting(true);
    try {
      const payload = {
        productName: values.productName,
        productDescription: values.productDescription,
        minimumQty: Number(values.minimumQty),
        hsnCode: values.hsnCode,
        units: values.units
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/products/create-product`,
        payload
      );

      const newProduct = response.data;
      setItems((prev) => [newProduct, ...prev]);

      toast.success("Product created successfully!");
      resetForm();
      setShowForm(false);
    } catch (error) {
      if (error.response && error.response.data.field === "productName") {
        const errorMessage = "Product with this name already exists";
        setFieldError("productName", errorMessage);
        toast.error(errorMessage);
      } else if (error.response && error.response.data.field) {
        const errorMessage = error.response.data.message || "Validation failed";
        setFieldError(error.response.data.field, errorMessage);
        toast.error(errorMessage);
      } else {
        console.error("Error saving product:", error);
        toast.error(error.response?.data?.message || "Failed to create product.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Select item for modal
  const selectItem = (productId) => {
    setSelectedItem(prev => prev === productId ? null : productId);
  };

  // Export selected as PDF
  const exportSelectedAsPDF = () => {
    if (!selectedItem) {
      toast.warning("Please select a product to export");
      return;
    }

    const item = items.find(i => i.productId === selectedItem);

    const content = `
    <div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff;">
      <h1 style="color: #3f3f91; text-align: center; margin-bottom: 20px; font-size: 24px;">
        Product Details
      </h1>

      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
        <h2 style="color: #3f3f91; margin-bottom: 15px; font-size: 20px;">
          ${item.productName}
        </h2>
        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 15px;" />
        
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Description:</strong> ${item.productDescription}
        </p>

        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Minimum Quantity:</strong> ${item.minimumQty} ${item.units}
        </p>

        <p style="margin: 10px 0; font-size: 14px;">
          <strong>HSN Code:</strong> ${item.hsnCode}
        </p>

        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Units:</strong> ${item.units}
        </p>

        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Created At:</strong> ${new Date(item.createdAt || item._id?.getTimestamp()).toLocaleDateString()}
        </p>
      </div>
    </div>
  `;

    const opt = {
      margin: 10,
      filename: `${item.productName}_details.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(content).set(opt).save();
  };

  // Export all as Excel
  const exportAllAsExcel = () => {
    const dataToExport = filteredItems.length > 0 ? filteredItems : items;

    if (dataToExport.length === 0) {
      toast.warning("No products to export");
      return;
    }

    const data = dataToExport.map(item => ({
      "Product Name": item.productName,
      "Description": item.productDescription,
      "Minimum Quantity": item.minimumQty,
      "Units": item.units,
      "HSN Code": item.hsnCode,
      "Created Date": new Date(item.createdAt || item._id?.getTimestamp()).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const fileName = debouncedSearch ? "filtered_products.xlsx" : "all_products.xlsx";
    XLSX.writeFile(workbook, fileName);
  };

  // Handle update item
  const handleUpdateItem = async (updatedItem) => {
    try {
      const { productId, _id, createdAt, updatedAt, ...itemData } = updatedItem;

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/products/update-product/${updatedItem.productId}`,
        itemData
      );

      setItems(prev =>
        prev.map(item =>
          item.productId === updatedItem.productId ? response.data : item
        )
      );

      toast.success("Product updated successfully!");
    } catch (error) {
      console.error("Error updating product:", error);

      if (error.response && error.response.data.field === "productName") {
        toast.error("Product with this name already exists");
      } else {
        toast.error(error.response?.data?.message || "Error updating product");
      }
    }
  };

  // Handle delete item
  const handleDeleteItem = async (productId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/products/delete-product/${productId}`
      );

      setItems(prev =>
        prev.filter(item => item.productId !== productId)
      );

      setSelectedItem(null);
      toast.success("Product deleted successfully!");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error(error.response?.data?.message || "Error deleting product");
    }
  };

  // Download template for bulk upload
  const downloadTemplate = () => {
    try {
      const templateData = [
        ['Product Name', 'Product Description', 'Minimum Quantity', 'HSN Code', 'Units'],
        ['Example Product 1', 'This is a sample product description', '10', '123456', 'NUMBERS'],
        ['Example Product 2', 'Another product description', '5', '789012', 'METERS'],
        ['Example Product 3', 'Third example description', '20', '345678', 'KG']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products Template');
      XLSX.writeFile(workbook, 'products_template.xlsx');

      toast.info("Template downloaded successfully!");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Failed to download template");
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async (fileEvent) => {
    // Get file from event - NO e.preventDefault() needed
    const file = fileEvent.target.files[0];

    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsBulkUploading(true);
    setUploadErrors([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/products/bulk-upload-products`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      const data = response.data;

      if (data.results?.failed?.length > 0) {
        // Format errors for display
        const formattedErrors = data.results.failed.map(fail => ({
          rowNumber: fail.row || 'N/A',
          productName: fail.product?.productName || fail.productName || 'Unknown',
          message: fail.reason || fail.message || 'Unknown error',
          details: fail.field ? `Field: ${fail.field}` : ''
        }));

        setUploadErrors(formattedErrors);
        setShowErrorModal(true);

        if (data.results?.successful?.length > 0) {
          toast.warning(`Uploaded ${data.results.successful.length} products with ${data.results.failed.length} errors`);
        } else {
          toast.error("Upload failed. No products were added.");
        }
      } else if (data.results?.successful?.length > 0) {
        toast.success(`Successfully uploaded ${data.results.successful.length} products!`);
      }

      // Refresh products list if any were added
      if (data.results?.successful?.length > 0) {
        const productsResponse = await axios.get(`${import.meta.env.VITE_API_URL}/products/get-products`);
        const sortedData = productsResponse.data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt)
            : (a._id?.getTimestamp ? new Date(a._id.getTimestamp()) : new Date(0));
          const dateB = b.createdAt ? new Date(b.createdAt)
            : (b._id?.getTimestamp ? new Date(b._id.getTimestamp()) : new Date(0));
          return dateB - dateA;
        });
        setItems(sortedData);
      }

      // Close modal if no errors
      if (data.results?.failed?.length === 0) {
        setShowBulkUpload(false);
        // Reset file input
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
      }

    } catch (error) {
      console.error("Error in bulk upload:", error);

      // Handle structured errors from backend
      if (error.response?.data?.results?.failed) {
        const formattedErrors = error.response.data.results.failed.map(fail => ({
          rowNumber: fail.row || 'N/A',
          productName: fail.product?.productName || fail.productName || 'Unknown',
          message: fail.reason || fail.message || 'Unknown error',
          details: fail.field ? `Field: ${fail.field}` : ''
        }));

        setUploadErrors(formattedErrors);
        setShowErrorModal(true);
        toast.error("Upload failed with errors. Please check the error report.");
      } else {
        toast.error(error.response?.data?.message || "Failed to process bulk upload");
      }
    } finally {
      setIsBulkUploading(false);
    }
  };

  // Download error report
  const downloadErrorReport = () => {
    try {
      const errorData = [
        ['Row', 'Product Name', 'Error Reason', 'Details']
      ];

      uploadErrors.forEach((error) => {
        errorData.push([
          error.rowNumber,
          error.productName,
          error.message,
          error.details || ''
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(errorData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Upload Errors');

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `upload-errors-${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);
      toast.info("Error report downloaded successfully!");
    } catch (error) {
      console.error("Error downloading error report:", error);
      toast.error("Failed to download error report");
    }
  };

  // Item Modal Component
  const ItemModal = ({ item, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (item) {
        setEditedItem({ ...item });
      }
    }, [item]);

    const handleInputChange = (e) => {
      const { name, value } = e.target;

      if (name === 'minimumQty') {
        setEditedItem(prev => ({ ...prev, [name]: Number(value) }));
      } else {
        setEditedItem(prev => ({ ...prev, [name]: value }));
      }
    };

    const handleSave = async () => {
      if (!editedItem.productName || !editedItem.productDescription ||
        !editedItem.minimumQty || !editedItem.hsnCode || !editedItem.units) {
        toast.error("All fields are required");
        return;
      }

      if (editedItem.minimumQty < 0) {
        toast.error("Minimum quantity cannot be negative");
        return;
      }

      try {
        await onUpdate(editedItem);
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating product:", error);
      }
    };

    if (!item) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Product" : `Product Details: ${item.productName}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              <div className="detail-row">
                <span className="detail-label">Product Name:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="productName"
                    value={editedItem.productName || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{item.productName}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Description:</span>
                {isEditing ? (
                  <textarea
                    name="productDescription"
                    value={editedItem.productDescription || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                    rows="3"
                  />
                ) : (
                  <span className="detail-value">{item.productDescription}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Minimum Quantity:</span>
                {isEditing ? (
                  <input
                    type="number"
                    name="minimumQty"
                    value={editedItem.minimumQty || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                    min="0"
                    step="1"
                  />
                ) : (
                  <span className="detail-value">{item.minimumQty} {item.units}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">HSN Code:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="hsnCode"
                    value={editedItem.hsnCode || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{item.hsnCode}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Units:</span>
                {isEditing ? (
                  <select
                    name="units"
                    value={editedItem.units || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  >
                    <option value="">Select Units</option>
                    {UNITS_OPTIONS.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="detail-value">{item.units}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(item.createdAt || item._id?.getTimestamp()).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="export-btn" onClick={onExport}>
              <FaFileExport /> Export as PDF
            </button>
            <button
              className={`update-btn ${isEditing ? 'save-btn' : ''}`}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save Changes" : "Update"}
            </button>
            <button
              className="delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <FaTrash /> Delete
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete {item.productName}? This action cannot be undone.</p>
              <div className="confirm-buttons">
                <button
                  className="confirm-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-delete"
                  onClick={() => {
                    onDelete(item.productId);
                    setShowDeleteConfirm(false);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Bulk Upload Modal Component - COMPLETELY FIXED
  const BulkUploadModal = ({ onClose, onUpload, onDownloadTemplate, isUploading }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const handleDragOver = (e) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
          setSelectedFile(file);
        } else {
          toast.error("Please select a valid Excel file (.xlsx or .xls)");
        }
      }
    };

    const handleFileInputChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          setSelectedFile(file);
        } else {
          toast.error("Please select a valid Excel file (.xlsx or .xls)");
        }
      }
    };

    const handleUpload = () => {
      if (!selectedFile) {
        toast.error("Please select a file first");
        return;
      }

      // Create a new FileList-like object
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(selectedFile);

      // Create a synthetic event
      const event = {
        target: {
          files: dataTransfer.files
        }
      };

      onUpload(event);
    };

    return (
      <div className="modal-overlay" onClick={isUploading ? undefined : onClose}>
        <div className="modal-content bulk-upload-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Bulk Upload Products</div>
            {!isUploading && (
              <button className="modal-close" onClick={onClose}>
                &times;
              </button>
            )}
          </div>

          <div className="modal-body">
            <div className="upload-instructions">
              <h4>Instructions:</h4>
              <ul>
                <li>Download the template file to ensure proper formatting</li>
                <li>Your Excel file must have these columns:</li>
                <li className="column-list">
                  <strong>Product Name</strong> (Required) - Must be unique
                </li>
                <li className="column-list">
                  <strong>Product Description</strong> (Required) - Detailed description
                </li>
                <li className="column-list">
                  <strong>Minimum Quantity</strong> (Required) - Number (must be 0 or more)
                </li>
                <li className="column-list">
                  <strong>HSN Code</strong> (Required) - 4-8 digit code
                </li>
                <li className="column-list">
                  <strong>Units</strong> (Required) - Must be: NOS, METERS, KG, GRAM, LITRE, ML
                </li>
              </ul>
              <div className="warning-note">
                <FaExclamationTriangle /> Duplicate product names will be rejected with error report
              </div>
            </div>

            {!isUploading && (
              <div className="template-download">
                <button type="button" onClick={onDownloadTemplate} className="template-download-btn">
                  <FaFileDownload /> Download Template
                </button>
              </div>
            )}

            <div
              className={`file-dropzone ${isDragging ? 'active' : ''} ${isUploading ? 'uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={isUploading ? undefined : handleDrop}
              onClick={isUploading ? undefined : () => document.getElementById('file-input').click()}
            >
              {isUploading ? (
                <>
                  <div className="loading-spinner large"></div>
                  <p>Processing your file, please wait...</p>
                </>
              ) : (
                <>
                  <FaUpload size={40} color="#7366ff" />
                  {selectedFile ? (
                    <div className="selected-file">
                      <p><strong>Selected:</strong> {selectedFile.name}</p>
                      <button
                        type="button"
                        className="remove-file-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          // Reset the file input
                          document.getElementById('file-input').value = '';
                        }}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ) : (
                    <p>Drag & drop your Excel file here or <span className="browse-link">browse</span></p>
                  )}
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                </>
              )}
            </div>

            {!isUploading && (
              <div className="modal-actions">
                <button type="button" onClick={onClose} className="cancel-btn">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  className="submit-btn"
                  disabled={!selectedFile}
                >
                  Upload File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Error Report Modal
  const ErrorReportModal = ({ errors, onClose, onDownload }) => {
    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content error-report-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              <FaExclamationTriangle style={{ color: '#ff9800', marginRight: '8px' }} />
              Upload Error Report
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="error-report-content">
            <div className="error-summary">
              <p><strong>{errors.length} errors found during upload:</strong></p>
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
                  {errors.map((error, index) => (
                    <tr key={index} className="error-row">
                      <td className="error-row-number">#{error.rowNumber}</td>
                      <td className="error-product">{error.productName}</td>
                      <td className="error-reason">
                        <span className="error-message">{error.message}</span>
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
              <button onClick={onDownload} className="download-error-btn">
                <FaFileDownload /> Download Error Report
              </button>
              <button onClick={onClose} className="close-error-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Navbar onNavigation={handleNavigation}>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              <button className="export-all-btn" onClick={exportAllAsExcel}>
                <FaFileExcel /> Export
              </button>
              <button className="bulk-upload-btn" onClick={() => setShowBulkUpload(true)}>
                <FaUpload /> Bulk
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close" : "Add"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Add New Product</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              <Form>
                <div className="form-row">
                  <div className="form-field">
                    <label><FaCubes /> Product Name *</label>
                    <Field name="productName" type="text" placeholder="Enter product name" />
                    <ErrorMessage name="productName" component="div" className="error" />
                  </div>

                  <div className="form-field">
                    <label><FaRulerCombined /> Units *</label>
                    <Field as="select" name="units" className="select-field">
                      <option value="">Select Units</option>
                      {UNITS_OPTIONS.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage name="units" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaSortNumericDown /> Minimum Quantity *</label>
                    <Field
                      name="minimumQty"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Enter minimum quantity"
                    />
                    <ErrorMessage name="minimumQty" component="div" className="error" />
                  </div>

                  <div className="form-field">
                    <label><FaHashtag /> HSN Code *</label>
                    <Field
                      name="hsnCode"
                      type="text"
                      placeholder="Enter HSN code (4-8 digits)"
                    />
                    <ErrorMessage name="hsnCode" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field full-width">
                    <label><FaAlignLeft /> Product Description *</label>
                    <Field
                      name="productDescription"
                      as="textarea"
                      rows="3"
                      placeholder="Enter product description"
                    />
                    <ErrorMessage name="productDescription" component="div" className="error" />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Product"}
                  {isSubmitting && <span className="loading-spinner"></span>}
                </button>
              </Form>
            </Formik>
          </div>
        )}

        <div className="data-table">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner large"></div>
              <p>Loading products...</p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Description</th>
                    <th>Min. Quantity</th>
                    <th>Units</th>
                    <th>HSN Code</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, index) => (
                    <tr
                      key={item.productId || index}
                      className={selectedItem === item.productId ? 'selected' : ''}
                      onClick={() => selectItem(item.productId)}
                    >
                      <td>{item.productName}</td>
                      <td className="description-cell">
                        {item.productDescription?.length > 50
                          ? `${item.productDescription.substring(0, 50)}...`
                          : item.productDescription}
                      </td>
                      <td>{item.minimumQty}</td>
                      <td>{item.units}</td>
                      <td>{item.hsnCode}</td>
                      <td>
                        <button
                          className="view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectItem(item.productId);
                          }}
                          title="View Details"
                        >
                          <FaEdit />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMoreItems && (
                <div className="load-more-container">
                  <button className="load-more-btn" onClick={loadMoreItems}>
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {selectedItem && (
          <ItemModal
            item={items.find(i => i.productId === selectedItem)}
            onClose={() => setSelectedItem(null)}
            onExport={exportSelectedAsPDF}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
          />
        )}

        {showBulkUpload && (
          <BulkUploadModal
            onClose={() => {
              setShowBulkUpload(false);
              setUploadFile(null);
              setUploadErrors([]);
            }}
            onUpload={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            isUploading={isBulkUploading}
          />
        )}

        {showErrorModal && (
          <ErrorReportModal
            errors={uploadErrors}
            onClose={() => {
              setShowErrorModal(false);
              setUploadErrors([]);
            }}
            onDownload={downloadErrorReport}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Items;