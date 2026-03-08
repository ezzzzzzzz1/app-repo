// routes/shopify.js
const express = require('express');
const router = express.Router();
const shopifyService = require('../services/shopify');
const db = require('../db'); 
const axios = require('axios');


// // Products Routes
// router.get('/products', async (req, res) => {
//     try {
//         const response = await shopifyService.getProducts();
//         // 🔥 Fixed: makeRequest returns the data directly
//         res.json(response); 
//     } catch (error) { 
//         res.status(500).json({ error: error.message }); 
//     }
// });

router.get('/products', async (req, res) => {
    try {
        // 🔥 GET FROM MYSQL, NOT SHOPIFY
        const [rows] = await db.execute('SELECT * FROM products ORDER BY id DESC');
        
        // Wrap it in an object so your existing frontend logic doesn't break
        res.json({ products: rows }); 
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 🔥 Update Product Route
// routes/shopify.js

router.put('/products/:id', async (req, res) => {
    const productId = req.params.id;
    const { title, price } = req.body;

    try {
        // 1. Update Shopify First
        const response = await shopifyService.updateProductDetails(productId, req.body);

        // 2. Update MySQL Database
        // We update based on shopify_id because that's what the 'id' variable is holding
        const sql = `UPDATE products SET title = ?, price = ? WHERE shopify_id = ?`;
        await db.execute(sql, [title, price, productId]);

        res.json({ success: true, message: "Updated in Shopify and Database" });
    } catch (error) {                
        console.error("Update Error:", error.message);
        res.status(500).json({ error: error.message }); 
    }
});

// Orders Routes
router.get('/orders', async (req, res) => {
    try {
        const response = await shopifyService.getOrders();
        res.json(response);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// 🔥 Update Order Address Route
router.put('/orders/:id/address', async (req, res) => {
    try {
        const response = await shopifyService.updateOrderAddresses(req.params.id, req.body);
        res.json(response);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});
// routes/shopify.js
router.post('/products/add', async (req, res) => {
    try {
        console.log("📥 Received manual add request:", req.body.title);
        
        // This calls the service function that handles BOTH Shopify and MySQL
        const result = await shopifyService.addProductToBoth(req.body);
        
        res.json({ success: true, product: result.product });
    } catch (error) {
        console.error("❌ Manual Add Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
// routes/shopify.js

// 🔥 تأكد أن النوع هو POST والمسار يبدأ بـ /products/push/
router.post('/products/push/:id', async (req, res) => {
    console.log("Pushing product ID:", req.params.id); // للتأكد في الـ Terminal
    try {
        // 1. جلب بيانات المنتج من الداتابيز المحلية
        const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "Product not found in local DB" });
        }

        const product = rows[0];

        // 2. إرسال البيانات لـ Shopify (تأكد من وجود دالة createProduct في الـ Service)
        const shopifyPayload = {
            product: {
                title: product.title,
                body_html: product.description,
                status: 'active',
                variants: [
                    { 
                        price: product.price, 
                        inventory_management: "shopify",
                        inventory_quantity: parseInt(product.inventory) || 0 
                    }
                ]
            }
        };

        const shopifyResponse = await shopifyService.makeRequest('POST', '/products.json', shopifyPayload);
        const newShopifyId = shopifyResponse.product.id;

        // 3. تحديث الداتابيز بالـ ID الجديد
        await db.execute('UPDATE products SET shopify_id = ? WHERE id = ?', [newShopifyId.toString(), req.params.id]);

        res.json({ success: true, shopifyId: newShopifyId });
    } catch (error) {
        console.error("Push Error Details:", error);
        res.status(500).json({ error: error.message });
    }
});

// Add this to your routes/shopify.js
router.get('/verify/:sku', async (req, res) => {
    try {
        // Search Shopify for products with this SKU
        const data = await shopifyService.makeRequest('GET', `/products/search.json?query=sku:${req.params.sku}`);
        
        if (data.products && data.products.length > 0) {
            res.json({ found: true, details: data.products[0] });
        } else {
            res.json({ found: false, message: "Product not found in Shopify." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/import-bino-test', async (req, res) => {
    try {
        const modelId = "2d247c89-7252-4a6c-baec-9ace35d22b46"; // الـ ID الذي أرسلته لي
        const product = await shopifyService.importFromBino(modelId);
        res.json({ success: true, shopify_url: `https://mohamed-ezzeldine-48-teststore.myshopify.com/admin/products/${product.id}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/import-bino', async (req, res) => {
    try {
        const { modelId } = req.body;
        console.log("1. Starting Import for ModelId:", modelId);

        // Fetch from BinoKids
        const binoResponse = await axios.put('https://binokids.com/BinoKidsAPIV3/ModelType/getModelDetails', {
            UserId: 16314,
            ModelId: modelId,
            UserRole: 2,
            Lang: 1
        });

        const m = binoResponse.data.modelList;
        if (!m) throw new Error("BinoKids returned empty data");
        console.log("2. Data received from BinoKids:", m.ModelTypeName);

        // Map to Shopify Variants
        const variants = [];
        m.Colors.forEach(color => {
            color.SizesOfThisColorList.forEach(size => {
                variants.push({
                    option1: color.ColorName,
                    option2: size.Name,
                    price: m.PriceAfterDiscount.toString(),
                    compare_at_price: m.PriceBeforeDiscount.toString(),
                    inventory_management: "shopify",
                    inventory_quantity: 10,
                    sku: `${m.ModelCode}-${color.ColorId}-${size.ID}`
                });
            });
        });

        // Prepare Payload
        const shopifyPayload = {
            product: {
                title: `${m.ModelTypeName} - ${m.ModelCode}`,
                body_html: `<strong>Brand:</strong> ${m.ModelTradeMarkName}<br><strong>Material:</strong> ${m.ModelMaterialName}`,
                status: "active",
                options: [{ name: "Color" }, { name: "Size" }],
                variants: variants,
                images: m.ImageList.map(img => ({ src: img.ImageName }))
            }
        };

        // Send to Shopify
        const shopifyRes = await shopifyService.makeRequest('POST', '/products.json', shopifyPayload);
        console.log("3. Shopify Response Received");

        res.json({ success: true, product: shopifyRes.product });
    } catch (error) {
        console.error("❌ Import Failed:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
module.exports = router;
