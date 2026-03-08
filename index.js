const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const db = require('./db');

require('dotenv').config();
const shopifyService = require('./services/shopify');
const shopifyRoutes = require('./routes/shopify');
const axios = require('axios');
const app = express();
const myInventoryList = [
    "2d247c89-7252-4a6c-baec-9ace35d22b46",
    // "id-tany-hina",  <-- تقدري تضيفي أي عدد هنا
];

const autoBridgeBinoToShopify = async (modelId) => {
    try {
        console.log(`📡 Checking BinoKids for ID: ${modelId}...`);

        const binoResponse = await axios.put('https://binokids.com/BinoKidsAPIV3/ModelType/getModelDetails', {
            UserId: 16314,
            ModelId: modelId,
            UserRole: 2,
            Lang: 1
        });

        const m = binoResponse.data.modelList;
        if (!m) return;س

        const productTitle = `${m.ModelTypeName} - ${m.ModelCode}`;

        // 1. البحث عن المنتج الحالي في شوبيفاي
        const searchUrl = `/products.json?title=${encodeURIComponent(productTitle)}`;
        const existingProducts = await shopifyService.makeRequest('GET', searchUrl);
        
        // البحث عن المطابقة التامة للعنوان
        const existingProduct = existingProducts.products?.find(p => p.title.trim() === productTitle.trim());

        // 2. تجهيز البيانات (Payload)
        const shopifyPayload = {
            product: {
                title: productTitle,
                body_html: `<strong>Brand:</strong> ${m.ModelTradeMarkName}<br><strong>Material:</strong> ${m.ModelMaterialName}`,
                status: "active",
                vendor: m.ModelTradeMarkName,
                options: [{ name: "Color" }, { name: "Size" }],
                variants: m.Colors.flatMap(color => 
                    color.SizesOfThisColorList.map(size => ({
                        option1: color.ColorName,
                        option2: size.Name,
                        price: m.PriceAfterDiscount.toString(),
                        compare_at_price: m.PriceBeforeDiscount.toString(),
                        inventory_management: "shopify",
                        inventory_quantity: 10,
                        sku: `${m.ModelCode}-${color.ColorId}-${size.ID}`
                    }))
                ),
                images: m.ImageList.map(img => ({ src: img.ImageName }))
            }
        };

        if (existingProduct) {
            // 🔥 تحديث المنتج الموجود (Update) ليعكس أي تغيير في API BinoKids
            console.log(`🔄 UPDATING: "${productTitle}" with latest data...`);
            await shopifyService.makeRequest('PUT', `/products/${existingProduct.id}.json`, shopifyPayload);
            console.log(`✅ UPDATED: "${productTitle}" successfully.`);
        } else {
            // ✨ إضافة منتج جديد (Add)
            console.log(`🚀 ADDING: "${productTitle}" to Shopify...`);
            const shopifyRes = await shopifyService.makeRequest('POST', '/products.json', shopifyPayload);
            console.log(`✅ ADDED: "${productTitle}" successfully.`);
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
};
 
const runSystem = async () => {
    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Starting Sync Cycle...`);
    
    for (const id of myInventoryList) {
        await autoBridgeBinoToShopify(id);
        // استراحة بسيطة
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log("🏁 Cycle finished. Next check in 60 seconds.");
};

// تشغيل كل دقيقة
setInterval(runSystem, 60000);
runSystem(); 
// 1. دالة لجلب كل الموديلات من الـ API "على طول"
// 1. الدالة التي تحاول جلب القائمة بـ "هوية متصفح" (User-Agent)


// 2. المحرك الرئيسي (الذي يعمل 24 ساعة)


// تشغيل النظام

// تشغيل فوري عند البدء
// const autoBridgeBinoToShopify = async (modelId) => {
//     try {
//         console.log(`📡 Fetching ${modelId} from BinoKids...`);

//         // 1. طلب البيانات من BinoKids
//         const binoResponse = await axios.put('https://binokids.com/BinoKidsAPIV3/ModelType/getModelDetails', {
//             UserId: 16314,
//             ModelId: modelId,
//             UserRole: 2,
//             Lang: 1
//         });

//         const m = binoResponse.data.modelList;

//         if (!m) {
//             console.error(`❌ BinoKids Error: No data found for ID ${modelId}`);
//             return;
//         }

//         const productTitle = `${m.ModelTypeName} - ${m.ModelCode}`;

//         // 2. 🔥 التحقق: هل المنتج موجود بالفعل في شوبيفاي؟
//         // نبحث بالعنوان لأنه يحتوي على الكود الفريد ModelCode
//         const existingProducts = await shopifyService.makeRequest(
//             'GET', 
//             `/products.json?title=${encodeURIComponent(productTitle)}`
//         );

//         if (existingProducts.products && existingProducts.products.length > 0) {
//             console.log(`⏭️ Skipping: "${productTitle}" is already in Shopify.`);
//             return existingProducts.products[0]; // نرجع المنتج الموجود بدلاً من إنشائه
//         }

//         // 3. تحويل البيانات (Mapping)
//         const shopifyPayload = {
//             product: {
//                 title: productTitle,
//                 body_html: `<strong>Brand:</strong> ${m.ModelTradeMarkName}<br><strong>Material:</strong> ${m.ModelMaterialName}`,
//                 status: "active",
//                 vendor: m.ModelTradeMarkName,
//                 options: [{ name: "Color" }, { name: "Size" }],
//                 variants: m.Colors.flatMap(color => 
//                     color.SizesOfThisColorList.map(size => ({
//                         option1: color.ColorName,
//                         option2: size.Name,
//                         price: m.PriceAfterDiscount.toString(),
//                         compare_at_price: m.PriceBeforeDiscount.toString(),
//                         inventory_management: "shopify",
//                         inventory_quantity: 10,
//                         sku: `${m.ModelCode}-${color.ColorId}-${size.ID}`
//                     }))
//                 ),
//                 images: m.ImageList.map(img => ({ src: img.ImageName }))
//             }
//         };

//         // 4. الإرسال إلى شوبيفاي
//         console.log(`🚀 Sending ${m.ModelCode} to Shopify...`);
//         const shopifyRes = await shopifyService.makeRequest('POST', '/products.json', shopifyPayload);

//         console.log(`✅ Success! Product created with ID: ${shopifyRes.product.id}`);
//         return shopifyRes.product;

//     } catch (error) {
//         console.error("❌ Bridge Error:", error.response ? error.response.data : error.message);
//     }
// };

// --- دالة لجلب كل الموديلات من الـ API مباشرة ---
// const getAllModelsFromBino = async () => {
//     try {
//         const response = await axios.post('https://binokids.com/BinoKidsAPIV3/ModelType/getModelTypes', {
//             UserId: 16314,
//             Lang: 1,
//             CategoryId: 0 
//         });
//         // دي بترجع مصفوفة (Array) فيها كل الـ IDs المتاحة دلوقتي على API بينو كيدز
//         return response.data.modelList || []; 
//     } catch (error) {
//         console.error("❌ فشل جلب القائمة من API:", error.message);
//         return [];
//     }
// };

// --- المحرك اللي بيشغل الدالة بتاعتك أوتوماتيك ---
// const startEverything = async () => {
//     console.log("🚀 جاري سحب المنتجات من الـ API مباشرة...");

//     // ١. بنجيب القائمة من الـ API
//     const models = await getAllModelsFromBino();

//     // ٢. بنلف على كل موديل ونشغل الكود بتاعك (اللي إنتي بعتيه)
//     for (const model of models) {
//         // بنبعت الـ GuID للدالة بتاعتك عشان ترفعه
//         await autoBridgeBinoToShopify(model.GuID);
        
//         // استراحة ثانية عشان السيستم ميهنجش
//         await new Promise(r => setTimeout(r, 1000));
//     }
    
//     console.log("🏁 انتهت عملية المزامنة بنجاح.");
// };

// // --- السطر اللي بيخلي كل ده يشتغل أول ما تعملي Run للملف ---
// startEverything();
// cron.schedule('0 * * * *', async () => {
//     console.log('--- 🕒 Starting Automatic BinoKids Sync ---');

//     try {
//         // 1. Get the list of Model IDs you want to sync
//         // You can fetch these from your MySQL database where 'is_synced' = 0
//         const productsToSync = await db.query("SELECT model_id FROM products WHERE is_synced = 0 LIMIT 10");

//         for (const item of productsToSync) {
//             console.log(`Syncing Model: ${item.model_id}`);
            
//             // 2. Call the BinoKids API
//             const binoRes = await axios.put('https://binokids.com/BinoKidsAPIV3/ModelType/getModelDetails', {
//                 UserId: 16314,
//                 ModelId: item.model_id,
//                 UserRole: 2,
//                 Lang: 1
//             });

//             const m = binoRes.data.modelList;
            
//             // 3. Prepare Shopify Payload (Same mapping logic as before)
//             const payload = {
//                 product: {
//                     title: `${m.ModelTypeName} - ${m.ModelCode}`,
//                     body_html: `<strong>Material:</strong> ${m.ModelMaterialName}`,
//                     status: "active",
//                     variants: m.Colors.flatMap(color => 
//                         color.SizesOfThisColorList.map(size => ({
//                             option1: color.ColorName,
//                             option2: size.Name,
//                             price: m.PriceAfterDiscount.toString(),
//                             sku: `${m.ModelCode}-${color.ColorId}-${size.ID}`
//                         }))
//                     ),
//                     images: m.ImageList.map(img => ({ src: img.ImageName }))
//                 }
//             };

//             // 4. Push to Shopify
//             const shopifyRes = await makeRequest('POST', '/products.json', payload);

//             if (shopifyRes.product) {
//                 // 5. IMPORTANT: Update your DB so it doesn't sync again
//                 await db.query("UPDATE products SET is_synced = 1, shopify_id = ? WHERE model_id = ?", 
//                     [shopifyRes.product.id, item.model_id]);
//                 console.log(`✅ Success: ${m.ModelCode} is now live.`);
//             }
//         }
//     } catch (err) {
//         console.error('❌ Auto-Sync Error:', err.message);
//     }
// });
cron.schedule('* * * * *', async () => {
    console.log('🔄 Checking for new products to sync...');

    try {
        // 1. جلب المنتجات التي لم ترفع بعد
        const [rows] = await db.execute("SELECT * FROM products WHERE sync_status = 'pending' AND shopify_id IS NULL");

        if (rows.length === 0) {
            console.log('✅ No pending products to sync.');
            return;
        }

        for (let product of rows) {
            console.log(`🚀 Automatically pushing: ${product.title}`);

            const shopifyPayload = {
                product: {
                    title: product.title,
                    body_html: product.description,
                    status: 'active',
                    inventory_management:'shopify',
                    images: product.image_base64 ? [
            { 
                attachment: product.image_base64, 
                filename: `image_${product.id}.jpg` 
            }
        ] : (product.image_url ? [{ src: product.image_url }] : []),
                    variants: [{ price: product.price, inventory_quantity: product.inventory }]
                }
            };

            // 2. إرسال لـ Shopify
            const shopifyResponse = await shopifyService.makeRequest('POST', '/products.json', shopifyPayload);
            const newShopifyId = shopifyResponse.product.id;

            // 3. تحديث الداتابيز: وضع الـ ID وتغيير الحالة لـ synced
            await db.execute(
                "UPDATE products SET shopify_id = ?, sync_status = 'synced' WHERE id = ?",
                [newShopifyId.toString(), product.id]
            );

            console.log(`✅ Product ${product.title} synced successfully!`);
        }
    } catch (error) {
        console.error('❌ Auto-sync error:', error.message);
    }
});
// This is your automatic function
const runAutoImport = async () => {
    console.log("🔍 Checking for new products to sync...");
    
    // 1. Get ONLY products that haven't been sent to Shopify yet
    const [rows] = await db.execute("SELECT * FROM products WHERE sync_status = 'pending' LIMIT 1");

    if (rows.length === 0) {
        console.log("😴 No new products found to sync.");
        return;
    }

    const product = rows[0];
    
    try {
        // 2. Run the BinoKids -> Shopify logic we built
        const result = await shopifyService.importFromBino(product.model_id);
        
        // 3. IMPORTANT: Mark as synced so it doesn't loop forever
        await db.execute("UPDATE products SET sync_status = 'synced', shopify_id = ? WHERE id = ?", [result.id, product.id]);
        
        console.log(`🚀 Successfully auto-synced: ${product.title}`);
    } catch (err) {
        console.error("❌ Auto-sync failed:", err.message);
    }
};

// RUN IT IMMEDIATELY FOR TESTING
runAutoImport();

// Then set it to run every 5 minutes
setInterval(runAutoImport, 300000);
// 1. Middlewares FIRST (The settings must come BEFORE the routes)
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. Logger (To see what's happening in the terminal)
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} to ${req.url}`);
    next();
});

// 3. Routes LAST (After all settings are applied)
app.use('/api/shopify', shopifyRoutes);
// At the bottom of your index.js
// مصفوفة الموديلات اللي عاوزة تراقبيها
// بمجرد ما تضيفي ID هنا، الكود هيرفعه لوحده في الدورة الجاية
// const monitoredModelIds = [
//     "2d247c89-7252-4a6c-baec-9ace35d22b46",
//     // أضيفي أي ID جديد هنا وسيعمل الكود تلقائياً
// ];

// // الدالة اللي بتشغل الكود بتاعك بشكل دوري
// const runContinuousSync = async () => {
//     console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Starting Background Sync...`);

//     for (const id of monitoredModelIds) {
//         // استدعاء الكود بتاعك زي ما هو بالظبط
//         await autoBridgeBinoToShopify(id);
        
//         // استراحة بسيطة (ثانية واحدة) عشان شوبيفاي ميحظرش السيرفر
//         await new Promise(resolve => setTimeout(resolve, 1000));
//     }

//     console.log("🏁 Cycle finished. Next check in 1 minute...");
// };

// // --- ضبط التوقيت ---

// // 1. تشغيل الكود كل دقيقة (60000 مللي ثانية)
// setInterval(runContinuousSync, 60000);

// // 2. تشغيل أول دورة فوراً عند تشغيل السيرفر
// runContinuousSync();
// 4. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend is running on http://localhost:${PORT}`);
});