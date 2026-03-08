// services/shopify.js
const axios = require('axios');
require('dotenv').config();
// services/shopify.js (إضافة فوق)
const db = require('../db'); 

// وظيفة لإضافة منتج جديد في MySQL وشوبيفاي معاً
// services/shopify.js

// services/shopify.js





const addProductToBoth = async (productData) => {
    const shopifyPayload = {
        product: {
            title: productData.title,
            body_html: productData.description || "",
            status: productData.status || "active",
            // 🔥 Use 'attachment' for Base64 data
            images: productData.image_base64 ? [
                { 
                    attachment: productData.image_base64, 
                    filename: productData.image_name 
                }
            ] : [],
            variants: [{
                price: productData.price,
                inventory_management: "shopify",
                inventory_quantity: parseInt(productData.inventory) || 0
            }]
        }
    };

    const shopifyResponse = await makeRequest('POST', '/products.json', shopifyPayload);
    const newProduct = shopifyResponse.product;
    
    // Get the URL of the uploaded image from Shopify's response
    const uploadedImageUrl = newProduct.images.length > 0 ? newProduct.images[0].src : null;

    // Save to MySQL
    const sql = `INSERT INTO products 
        (shopify_id, title, description, price, inventory, status, image_url) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        newProduct.id.toString(),
        productData.title,
        productData.description,
        productData.price,
        productData.inventory,
        productData.status,
        uploadedImageUrl // Now we save the real Shopify URL to our DB
    ];

    await db.execute(sql, values);
    return shopifyResponse;
};
const { SHOP_URL, ACCESS_TOKEN } = process.env;

const shopifyRequest = axios.create({
    baseURL: `https://${SHOP_URL}/admin/api/2024-01`,
    headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
    },
});

// Helper function to handle requests and log errors specifically
const makeRequest = async (method, path, data = null) => {
    try {
        const config = {
            method,
            url: path,
        };
        
        // 🔥 Fix: Do not send data if it's a GET request
        if (method.toUpperCase() !== 'GET' && data) {
            config.data = data;
        }

        const response = await shopifyRequest(config);
        return response.data;
    } catch (error) {
        // 🔥 Logs the real error from Shopify to your terminal
        if (error.response) {
            console.error("Shopify API Error Details:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
        throw error;
    }
};

// 1. Read Products
const getProducts = (order = 'created_at desc') => {
    // order can be: 'created_at desc', 'created_at asc', 'updated_at desc', etc.
    return makeRequest('GET', `/products.json?limit=250&order=${order}`);
};
// services/shopify.js

// This function now returns both the products AND the pagination info
// const getProducts = async (params = 'limit=250') => {
//     try {
//         const response = await shopifyRequest.get(`/products.json?${params}`);
        
//         // Shopify puts the "Next Page" link in the 'link' header
//         const linkHeader = response.headers.link;
//         let nextPageToken = null;

//         if (linkHeader && linkHeader.includes('rel="next"')) {
//             // Extract the page_info token for the next 250 products
//             const match = linkHeader.match(/page_info=([^&>]+)>; rel="next"/);
//             nextPageToken = match ? match[1] : null;
//         }

//         return {
//             products: response.data.products,
//             nextPage: nextPageToken
//         };
//     } catch (error) {
//         throw error;
//     }
// };
// 2. 🔥 Update Product Details (Name, Description, Quantity)
// ... inside services/shopify.js

// 🔥 FIXED: Update Product Details (Handles Variants Options)
const updateProductDetails = async (productId, updatedData) => {
    // 1. Get product details to find the variant ID and its options
    const productData = await makeRequest('GET', `/products/${productId}.json`);
    const variant = productData.product.variants[0]; // Assuming first variant

    // 2. Update the Product Title
    const productPayload = {
        product: {
            id: productId,
            title: updatedData.title
        }
    };
    await makeRequest('PUT', `/products/${productId}.json`, productPayload);

    // 3. Update the Variant Price (Include existing options to fix the error)
    const variantPayload = {
        variant: {
            id: variant.id,
            price: updatedData.price,
            option1: variant.option1, // 🔥 Essential
            option2: variant.option2, // 🔥 Essential
            option3: variant.option3  // 🔥 Essential
        }
    };
    return await makeRequest('PUT', `/variants/${variant.id}.json`, variantPayload);
};
// ...

// 3. Read Orders
const getOrders = () => makeRequest('GET', '/orders.json');

// 4. 🔥 Update Order Address (Fixes moving old to billing)
const updateOrderAddresses = (orderId, newAddressData) => {
    return makeRequest('PUT', `/orders/${orderId}.json`, {
        order: {
            id: orderId,
            shipping_address: newAddressData,
            billing_address: newAddressData // Ensures both are updated to avoid 400
        }
    });
};

module.exports = { 
    makeRequest,
    getProducts, 
    updateProductDetails, 
    getOrders, 
    updateOrderAddresses ,
    addProductToBoth
    
};