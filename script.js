// ==========================================
// 1. INITIALIZE SUPABASE
// ==========================================
const supabaseUrl = 'https://ezhyiguhutkkvymcfkpj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6aHlpZ3VodXRra3Z5bWNma3BqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwODU3MDgsImV4cCI6MjEwNjY2MTcwOH0.hUqs8TXz3FL3aEW14y0dHqCYZk4e_xW23-Kdapu_QF0'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. MAIN EVENT LISTENER (Handles all pages)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- Session Check & Logout ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        await checkUserSession();
        logoutBtn.addEventListener('click', async () => {
            const { error } = await supabaseClient.auth.signOut();
            const rootPath = window.location.pathname.includes('/html/') ? '../index.html' : 'index.html';
            if (!error) window.location.href = rootPath; 
        });
    }

    // --- Sign Up Page ---
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = signupForm.querySelector('#name').value;
            const email = signupForm.querySelectorAll('input[type="email"]')[0].value;
            const password = signupForm.querySelectorAll('input[type="password"]')[0].value;
            const retypePassword = signupForm.querySelector('#retypePassword').value;
            const formMessage = document.getElementById('formMessage');

            formMessage.style.color = '#ef4444';
            formMessage.textContent = '';
            if (password !== retypePassword) return formMessage.textContent = 'Passwords do not match.';

            const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: name } } });
            if (error) formMessage.textContent = error.message;
            else {
                alert("Sign Up Completed. Please login.");
                window.location.href = '../index.html'; 
            }
        });
    }

    // --- Login Page ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('#email').value;
            const password = loginForm.querySelector('#password').value;
            const errorMessage = document.getElementById('errorMessage');

            errorMessage.textContent = ''; 
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) errorMessage.textContent = error.message;
            else window.location.href = 'html/home.html'; 
        });
    }

    // --- Home Page ---
    const productGrid = document.getElementById('productGrid');
    if (productGrid) {
        const settings = await getStoreSettings();
        const rate = settings.exchange_rate;
        const { data: storeItems } = await supabaseClient.from('products').select('*');
        
        if (storeItems) {
            storeItems.forEach(item => {
                const mmkPrice = (item.price * rate).toLocaleString();
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <div class="product-icon">📄</div>
                    <h3 class="product-title">${item.name}</h3>
                    <p class="product-price">$${item.price} <span style="font-size:0.9rem; color:#94a3b8;">(${mmkPrice} Ks)</span></p>
                `;
                card.addEventListener('click', () => window.location.href = `detail.html?id=${item.id}`);
                productGrid.appendChild(card);
            });
        }
    }

    // --- Detail Page ---
    const detailContainer = document.getElementById('detailContainer');
    if (detailContainer) {
        const settings = await getStoreSettings();
        const rate = settings.exchange_rate;
        const urlParams = new URLSearchParams(window.location.search);
        const { data: item } = await supabaseClient.from('products').select('*').eq('id', parseInt(urlParams.get('id'))).single();

        if (item) {
            const mmkPrice = (item.price * rate).toLocaleString();
            detailContainer.innerHTML = `
                <div style="font-size: 5rem;">📄</div>
                <h1 style="color: white; margin: 1rem 0;">${item.name}</h1>
                <h2 style="color: #3b82f6; margin-bottom: 1rem;">$${item.price} <span style="font-size:1.5rem; color:#94a3b8;">(${mmkPrice} Ks)</span></h2>
                <p class="detail-desc">${item.description}</p>
                <button id="buyBtn" class="buy-btn">Buy Now</button>
            `;
            document.getElementById('buyBtn').addEventListener('click', () => window.location.href = `payment.html?id=${item.id}`);
        } else {
            detailContainer.innerHTML = `<h2 style="color: #ef4444;">Item not found</h2>`;
        }
    }

    // --- Payment Page (Multi-Step Manual Flow for Both Products & Requests) ---
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        const settings = await getStoreSettings();
        const rate = settings.exchange_rate;
        const urlParams = new URLSearchParams(window.location.search);
        
        let item = null;
        let isRequest = false;

        if (urlParams.get('id')) {
            const { data } = await supabaseClient.from('products').select('*').eq('id', parseInt(urlParams.get('id'))).single();
            item = data;
        } else if (urlParams.get('req_id')) {
            const { data } = await supabaseClient.from('requests').select('*').eq('id', parseInt(urlParams.get('req_id'))).single();
            item = data;
            isRequest = true;
            if (item) item.price = item.estimated_price; 
        }

        if (item) {
            const mmkPrice = (item.price * rate).toLocaleString();
            const summaryEl = document.getElementById('paymentSummary');
            if (summaryEl) summaryEl.textContent = `Total: $${item.price} (${mmkPrice} Ks)`;
        }

        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (isRequest && item) {
                const { data, error } = await supabaseClient.from('requests').update({ status: 'completed' }).eq('id', item.id).select();
                if (error || !data || data.length === 0) {
                    console.error("Failed to unlock script status.");
                }
            }

            document.getElementById('paymentFormContainer').style.display = 'none';
            document.getElementById('paymentSuccess').style.display = 'block';
            
            document.getElementById('downloadBtn').onclick = () => {
                if (isRequest && item && item.auto_generated_code) {
                    downloadCSFile(item.title, item.auto_generated_code);
                } else if (item && item.file_url) {
                    window.open(item.file_url, '_blank');
                }
            };
        });
    }

    // --- My Requests Page ---
    const myRequestsList = document.getElementById('myRequestsList');
    if (myRequestsList) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const { data: reqs, error } = await supabaseClient.from('requests').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
            
            if (error) myRequestsList.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
            else if (reqs.length === 0) myRequestsList.innerHTML = `<p style="color: #94a3b8;">You haven't requested any custom scripts yet.</p>`;
            else {
                myRequestsList.innerHTML = '';
                reqs.forEach(req => {
                    let badgeColor = '';
                    if (req.status === 'awaiting_payment') badgeColor = 'background-color: #8b5cf620; color: #a78bfa;'; 
                    else if (req.status === 'pending') badgeColor = 'background-color: #f59e0b20; color: #fbbf24;'; 
                    else if (req.status === 'completed') badgeColor = 'background-color: #22c55e20; color: #4ade80;'; 
                    else if (req.status === 'processing') badgeColor = 'background-color: #3b82f620; color: #60a5fa;'; 
                    
                    let actionHtml = '';
                    if (req.status === 'awaiting_payment') {
                        actionHtml = `<button class="dl-btn" style="background-color: #8b5cf6;" onclick="window.location.href='payment.html?req_id=${req.id}'">💳 Pay $${req.estimated_price} to Unlock</button>`;
                    } else if (req.status === 'completed' && req.auto_generated_code && req.auto_generated_code.trim() !== '') {
                        const safeCode = req.auto_generated_code.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, "\\n");
                        actionHtml = `<button class="dl-btn" onclick="downloadCSFile('${req.title}', '${safeCode}')">Download Script (.cs)</button>`;
                    } else if (req.status === 'completed') {
                        actionHtml = `<p style="color: #22c55e; font-size: 0.9rem; font-weight: bold;">Your script is ready! Check the main store catalog to purchase.</p>`;
                    }

                    const card = document.createElement('div');
                    card.className = 'request-card';
                    card.innerHTML = `
                        <div class="req-header">
                            <div>
                                <h3 style="margin-bottom: 0.5rem; color: white;">${req.title}</h3>
                                <span style="color: #94a3b8; font-size: 0.9rem;">Complexity: <strong style="color: white; text-transform: capitalize;">${req.complexity}</strong> | Est. Price: <strong style="color: white;">$${req.estimated_price}</strong></span>
                            </div>
                            <span class="status-badge" style="padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.85rem; font-weight: bold; text-transform: uppercase; ${badgeColor}">${req.status.replace('_', ' ')}</span>
                        </div>
                        <p style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">${req.description}</p>
                        <div>${actionHtml}</div>
                    `;
                    myRequestsList.appendChild(card);
                });
            }
        }
    }

    // --- Administration Load Data & Request Listing ---
    const adminReqList = document.getElementById('adminRequestsList');
    if (adminReqList) {
        const { data: reqs, error } = await supabaseClient.rpc('get_all_requests_admin');
        if (error) {
            adminReqList.innerHTML = `<p style="color: #ef4444;">Error loading requests: ${error.message}</p>`;
        } else if (!reqs || reqs.length === 0) {
            adminReqList.innerHTML = `<p style="color: #94a3b8;">No custom requests found.</p>`;
        } else {
            adminReqList.innerHTML = '';
            reqs.forEach(req => {
                const card = document.createElement('div');
                card.style.backgroundColor = '#1e2433';
                card.style.padding = '1.5rem';
                card.style.borderRadius = '8px';
                card.style.border = '1px solid #334155';
                
                let codeSection = '';
                let publishBtn = ''; 
                
                if (req.auto_generated_code) {
                    codeSection = `<details style="margin-top: 1rem; margin-bottom: 1rem;"><summary style="cursor: pointer; color: #3b82f6;">View AI Code</summary><pre style="background: #0f172a; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; color: #34d399; margin-top: 0.5rem;">${req.auto_generated_code}</pre></details>`;
                    publishBtn = `<button onclick="publishToStore(${req.req_id})" style="background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-left: auto;">🛒 Publish to Store</button>`;
                }

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <h3 style="color: white; margin: 0;">${req.title}</h3>
                        <span style="font-size: 0.85rem; color: #94a3b8;">${new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                    <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem;">From: <strong style="color: white;">${req.user_name}</strong> | Comp: <strong>${req.complexity}</strong> | $${req.estimated_price}</p>
                    <p style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 1rem;">${req.description}</p>
                    ${codeSection}
                    <div style="display: flex; align-items: center; gap: 1rem; border-top: 1px solid #334155; padding-top: 1rem; flex-wrap: wrap;">
                        <select id="status-${req.req_id}" style="padding: 0.5rem; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: white;">
                            <option value="pending" ${req.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="processing" ${req.status === 'processing' ? 'selected' : ''}>Processing</option>
                            <option value="awaiting_payment" ${req.status === 'awaiting_payment' ? 'selected' : ''}>Awaiting Payment</option>
                            <option value="completed" ${req.status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                        <button onclick="updateRequestStatus(${req.req_id})" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Save Status</button>
                        ${publishBtn}
                    </div>
                `;
                adminReqList.appendChild(card);
            });
        }
    }

    const editProductsList = document.getElementById('editProductsList');
    if (editProductsList) loadAdminProducts();

    // --- Admin User List Loader ---
    const usersList = document.getElementById('usersList');
    if (usersList) {
        const { data: users, error } = await supabaseClient.rpc('get_profiles_for_admin');
        if (error) {
            usersList.innerHTML = `<p style="color: #ef4444;">Error loading users: ${error.message}</p>`;
        } else if (!users || users.length === 0) {
            usersList.innerHTML = `<p style="color: #94a3b8;">No users found.</p>`;
        } else {
            usersList.innerHTML = ''; 
            users.forEach(user => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '1rem';
                row.style.borderBottom = '1px solid #334155';
                
                row.innerHTML = `
                    <div>
                        <strong style="color: white;">${user.full_name}</strong>
                        <div style="font-size: 0.8rem; color: #888;">ID: ${user.id}</div>
                    </div>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <select id="role-${user.id}" style="padding: 0.5rem; background: #0f172a; color: white; border: 1px solid #334155; border-radius: 4px;">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <button onclick="updateUserRole('${user.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold;">Save</button>
                    </div>
                `;
                usersList.appendChild(row);
            });
        }
    }

    // --- Global Settings Form ---
    const rateForm = document.getElementById('rateForm');
    if (rateForm) {
        const settings = await getStoreSettings();
        document.getElementById('exchangeRate').value = settings.exchange_rate;
        document.getElementById('priceSimple').value = settings.price_simple;
        document.getElementById('priceMedium').value = settings.price_medium;
        document.getElementById('priceComplex').value = settings.price_complex;

        rateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newRate = parseFloat(document.getElementById('exchangeRate').value);
            const pSimple = parseFloat(document.getElementById('priceSimple').value);
            const pMedium = parseFloat(document.getElementById('priceMedium').value);
            const pComplex = parseFloat(document.getElementById('priceComplex').value);
            const rateMessage = document.getElementById('rateMessage');
            
            const { data, error } = await supabaseClient.from('settings').update({ 
                exchange_rate: newRate, price_simple: pSimple, price_medium: pMedium, price_complex: pComplex
            }).eq('id', 1).select();
            
            if (error) {
                rateMessage.style.color = '#ef4444';
                rateMessage.textContent = error.message;
            } else if (!data || data.length === 0) {
                rateMessage.style.color = '#ef4444';
                rateMessage.textContent = 'Error: Database blocked the update. Run the SQL fix.';
            } else {
                rateMessage.style.color = '#22c55e';
                rateMessage.textContent = 'Settings updated successfully!';
                setTimeout(() => { rateMessage.textContent = ''; }, 3000);
            }
        });
    }

    // --- AI-Driven Custom Script Request Form ---
    const requestForm = document.getElementById('requestForm');
    if (requestForm && document.getElementById('analyzeBtn')) {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const aiPanel = document.getElementById('aiPanel');
        const analyzeMessage = document.getElementById('analyzeMessage');
        
        let currentRate = 3500;
        let evaluatedComplexity = '';
        let evaluatedUsdPrice = 0;
        let generatedCode = '';
        let basePrices = { simple: 15, medium: 50, complex: 150 };

        getStoreSettings().then(settings => { 
            currentRate = settings.exchange_rate; 
            basePrices.simple = settings.price_simple;
            basePrices.medium = settings.price_medium;
            basePrices.complex = settings.price_complex;
        });

        analyzeBtn.addEventListener('click', async () => {
            const title = document.getElementById('reqTitle').value;
            const desc = document.getElementById('reqDesc').value;

            if (!title || !desc) return analyzeMessage.textContent = "Please fill out the title and requirements first.";

            analyzeBtn.textContent = '🤖 AI is analyzing...';
            analyzeBtn.disabled = true;
            analyzeMessage.textContent = '';
            aiPanel.style.display = 'none';

            const prompt = `You are a Unity C# expert. Analyze this script request: Title: ${title}. Description: ${desc}. Classify complexity as exactly "simple", "medium", or "complex". Simple = basic movement, simple triggers. Medium = UI systems, basic AI. Complex = multiplayer, physics. If "simple", write the complete, working C# script for Unity. If not simple, leave the code blank. Return ONLY a valid JSON object in this exact format: {"complexity": "simple", "code": "using UnityEngine; ..."}`;

            let retries = 3;
            let success = false;

            while (retries > 0 && !success) {
                try {
                    // Make request securely through your Vercel backend server
                    const response = await fetch('/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: prompt })
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        const errMsg = data.error || `HTTP Error ${response.status}`;
                        if (errMsg.toLowerCase().includes('high demand') || response.status === 429 || response.status === 503) throw new Error("HIGH_DEMAND");
                        throw new Error(errMsg);
                    }

                    let resultText = data.candidates[0].content.parts[0].text;
                    const jsonStart = resultText.indexOf('{');
                    const jsonEnd = resultText.lastIndexOf('}');
                    if (jsonStart === -1 || jsonEnd === -1) throw new Error("AI did not return a valid JSON structure.");
                    
                    const aiResult = JSON.parse(resultText.substring(jsonStart, jsonEnd + 1));
                    evaluatedComplexity = aiResult.complexity.toLowerCase();
                    if (!basePrices[evaluatedComplexity]) evaluatedComplexity = 'medium'; 
                    generatedCode = aiResult.code || '';
                    evaluatedUsdPrice = basePrices[evaluatedComplexity];
                    const mmkPrice = (evaluatedUsdPrice * currentRate).toLocaleString();

                    document.getElementById('displayComplexity').textContent = evaluatedComplexity;
                    document.getElementById('displayPrice').textContent = `$${evaluatedUsdPrice} (${mmkPrice} Ks)`;
                    
                    const codeContainer = document.getElementById('codeContainer');
                    if (evaluatedComplexity === 'simple' && generatedCode && generatedCode.trim() !== '') {
                        codeContainer.style.display = 'block';
                        document.getElementById('codePreview').textContent = generatedCode;
                    } else {
                        codeContainer.style.display = 'none';
                    }

                    aiPanel.style.display = 'block';
                    analyzeBtn.style.display = 'none'; 
                    success = true; 

                } catch (error) {
                    if (error.message === "HIGH_DEMAND" && retries > 1) {
                        retries--;
                        analyzeBtn.textContent = `🤖 Server busy... Retrying (${3 - retries}/3)...`;
                        await new Promise(resolve => setTimeout(resolve, 2500)); 
                    } else {
                        analyzeMessage.textContent = error.message === "HIGH_DEMAND" ? "Google servers busy. Please try again later." : error.message;
                        analyzeBtn.textContent = '🤖 Analyze with AI';
                        analyzeBtn.disabled = false;
                        break;
                    }
                }
            }
        });

        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submitRequestBtn');
            submitBtn.textContent = 'Submitting...';
            submitBtn.disabled = true;

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) return;

            const { error } = await supabaseClient.from('requests').insert([{
                user_id: session.user.id,
                title: document.getElementById('reqTitle').value,
                description: document.getElementById('reqDesc').value,
                complexity: evaluatedComplexity,
                estimated_price: evaluatedUsdPrice,
                auto_generated_code: generatedCode,
                status: evaluatedComplexity === 'simple' && generatedCode ? 'awaiting_payment' : 'pending' 
            }]);

            if (error) {
                analyzeMessage.textContent = "Error: " + error.message;
                submitBtn.textContent = 'Confirm & Submit Request';
                submitBtn.disabled = false;
            } else {
                analyzeMessage.style.color = '#22c55e';
                analyzeMessage.textContent = "Request saved successfully! Redirecting...";
                setTimeout(() => { window.location.href = 'my-requests.html'; }, 2000);
            }
        });
    }

    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uploadBtn = document.getElementById('uploadBtn');
            const adminMessage = document.getElementById('adminMessage');
            
            uploadBtn.textContent = 'Uploading...';
            uploadBtn.disabled = true;

            const name = document.getElementById('prodName').value;
            const price = parseFloat(document.getElementById('prodPrice').value);
            const desc = document.getElementById('prodDesc').value;
            const fileInput = document.getElementById('prodFile');
            const file = fileInput.files[0];

            if (!file) return alert("Please select a file.");

            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabaseClient.storage.from('unity-scripts').upload(fileName, file);

            if (uploadError) {
                adminMessage.textContent = 'Upload failed: ' + uploadError.message;
                uploadBtn.textContent = 'Upload Product';
                uploadBtn.disabled = false;
                return;
            }

            const { data: publicUrlData } = supabaseClient.storage.from('unity-scripts').getPublicUrl(fileName);
            const { error: dbError } = await supabaseClient
                .from('products')
                .insert([{ name: name, price: price, description: desc, file_url: publicUrlData.publicUrl }]);

            if (dbError) {
                adminMessage.textContent = 'Database error: ' + dbError.message;
            } else {
                adminMessage.style.color = '#22c55e';
                adminMessage.textContent = 'Script uploaded successfully!';
                adminForm.reset();
                if (typeof loadAdminProducts === 'function') loadAdminProducts(); 
            }

            uploadBtn.textContent = 'Upload Product';
            uploadBtn.disabled = false;
            setTimeout(() => { adminMessage.textContent = ''; }, 3000);
        });
    }
});

// ==========================================
// 3. CORE HELPER FUNCTIONS & ADMIN RPC
// ==========================================
async function getStoreSettings() {
    const { data } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
    if (data) return data;
    return { exchange_rate: 3500, price_simple: 15, price_medium: 50, price_complex: 150 }; 
}

async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const rootPath = window.location.pathname.includes('/html/') ? '../index.html' : 'index.html';
    if (!session) return window.location.href = rootPath; 
    
    const { data: profile } = await supabaseClient.from('profiles').select('full_name, role').eq('id', session.user.id).single();
    if (profile) {
        if (window.location.href.includes('administration.html') && profile.role !== 'admin') {
            alert("Access Denied.");
            return window.location.href = 'home.html';
        }
        const adminNavLinks = document.getElementById('adminNavLinks');
        if (adminNavLinks && profile.role === 'admin') adminNavLinks.style.display = 'flex';
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) welcomeMessage.textContent = `Welcome back, ${profile.full_name}!`;
    }
}

window.updateUserRole = async function(userId) {
    const newRole = document.getElementById(`role-${userId}`).value;
    const { data, error } = await supabaseClient.rpc('update_user_role_admin', { target_id: userId, new_role: newRole });
    if (error) alert("Failed to update role: " + error.message);
    else alert("Role updated successfully!");
};

window.updateRequestStatus = async function(reqId) {
    const newStatus = document.getElementById(`status-${reqId}`).value;
    const { data, error } = await supabaseClient.from('requests').update({ status: newStatus }).eq('id', reqId).select();
    if (error) alert("Failed to update status: " + error.message);
    else if (!data || data.length === 0) alert("Update blocked by database permissions. Please run the SQL fix.");
    else alert("Status updated successfully!");
};

// ==========================================
// EDIT SCRIPT POPUP MODAL LOGIC
// ==========================================
window.loadAdminProducts = async function() {
    const editList = document.getElementById('editProductsList');
    if (!editList) return;
    
    const { data: products, error } = await supabaseClient.from('products').select('*').order('id', { ascending: false });
    if (error) {
        editList.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
        return;
    }
    if (products.length === 0) {
        editList.innerHTML = `<p style="color: #94a3b8;">No scripts uploaded yet.</p>`;
        return;
    }

    editList.innerHTML = '';
    products.forEach(p => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.background = '#0f172a';
        div.style.padding = '1rem';
        div.style.border = '1px solid #334155';
        div.style.borderRadius = '6px';
        div.style.marginBottom = '1rem';
        
        div.innerHTML = `
            <div>
                <h4 style="color: white; margin: 0 0 0.25rem 0;">${p.name}</h4>
                <span style="color: #94a3b8; font-size: 0.85rem;">Price: $${p.price}</span>
            </div>
            <button onclick="openEditModal(${p.id})" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold;">Edit</button>
        `;
        editList.appendChild(div);
    });
};

window.openEditModal = async function(id) {
    const numericId = parseInt(id);
    const { data: p, error } = await supabaseClient.from('products').select('*').eq('id', numericId).single();
    if (p) {
        document.getElementById('editModalId').value = p.id;
        document.getElementById('editModalTitle').textContent = `Edit: ${p.name}`;
        
        document.getElementById('editModalName').value = p.name;
        document.getElementById('editModalPrice').value = p.price;
        document.getElementById('editModalDesc').value = p.description;
        document.getElementById('editModalFile').value = ''; 
        document.getElementById('editModalMsg').textContent = '';
        document.getElementById('editModal').style.display = 'flex';
    }
};

window.closeEditModal = function() {
    document.getElementById('editModal').style.display = 'none';
};

window.saveProductFromModal = async function() {
    const id = parseInt(document.getElementById('editModalId').value);
    const msgEl = document.getElementById('editModalMsg');
    msgEl.textContent = 'Saving...';
    msgEl.style.color = '#fbbf24';

    const newName = document.getElementById('editModalName').value;
    const newPrice = parseFloat(document.getElementById('editModalPrice').value);
    const newDesc = document.getElementById('editModalDesc').value;
    const fileInput = document.getElementById('editModalFile');
    const file = fileInput.files[0];

    let updates = { name: newName, price: newPrice, description: newDesc };

    try {
        if (file) {
            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabaseClient.storage.from('unity-scripts').upload(fileName, file);
            if (uploadError) throw new Error("Upload failed: " + uploadError.message);
            
            const { data: publicUrlData } = supabaseClient.storage.from('unity-scripts').getPublicUrl(fileName);
            updates.file_url = publicUrlData.publicUrl;
        }

        const { data, error: dbError } = await supabaseClient.from('products').update(updates).eq('id', id).select();
        
        if (dbError) throw new Error(dbError.message);
        if (!data || data.length === 0) throw new Error("Database blocked the update (0 rows affected). Run the SQL fix.");

        msgEl.style.color = '#22c55e';
        msgEl.textContent = 'Updated successfully!';
        
        setTimeout(() => {
            closeEditModal();
            loadAdminProducts();
        }, 1500);
    } catch(err) {
        msgEl.style.color = '#ef4444';
        msgEl.textContent = err.message;
    }
};

window.deleteProductFromModal = async function() {
    const id = parseInt(document.getElementById('editModalId').value);
    if (!confirm('Are you sure you want to delete this script? This cannot be undone.')) return;
    
    const { data, error } = await supabaseClient.from('products').delete().eq('id', id).select();
    if (error) {
        alert("Error deleting script: " + error.message);
    } else if (!data || data.length === 0) {
        alert("Database blocked the deletion. Please run the SQL fix.");
    } else {
        alert("Script deleted successfully.");
        closeEditModal();
        loadAdminProducts(); 
    }
};

// ==========================================
// STORE PUBLISHING LOGIC
// ==========================================
window.publishToStore = async function(reqId) {
    try {
        const { data: req, error: fetchErr } = await supabaseClient.from('requests').select('*').eq('id', reqId).single();
        if (fetchErr || !req) throw new Error("Could not fetch the request data.");
        if (!req.auto_generated_code) throw new Error("No auto-generated code available to publish.");

        const priceInput = prompt(`Edit the store price (USD) for "${req.title}":`, req.estimated_price);
        if (priceInput === null) return; 

        const finalPrice = parseFloat(priceInput);
        if (isNaN(finalPrice) || finalPrice < 0) throw new Error("Invalid price. Publishing cancelled.");

        const descInput = prompt(`Edit the description for "${req.title}":`, req.description);
        if (descInput === null) return;
        const finalDesc = descInput.trim();

        let cleanCode = req.auto_generated_code.replace(/\\n/g, '\n').replace(/&quot;/g, '"');
        cleanCode = cleanCode.replace(/```csharp/gi, '').replace(/```cs/gi, '').replace(/```/g, '').trim();
        const safeTitle = req.title.replace(/[^a-zA-Z0-9]/g, '') || 'CustomScript';
        const fileName = `${Date.now()}_${safeTitle}.cs`;
        
        const fileBlob = new Blob([cleanCode], { type: 'text/plain' });
        
        const { error: uploadError } = await supabaseClient.storage.from('unity-scripts').upload(fileName, fileBlob);
        if (uploadError) throw new Error("Storage Upload failed: " + uploadError.message);
        
        const { data: publicUrlData } = supabaseClient.storage.from('unity-scripts').getPublicUrl(fileName);
        
        const { error: dbError } = await supabaseClient.from('products').insert([{ 
            name: req.title, 
            price: finalPrice, 
            description: finalDesc, 
            file_url: publicUrlData.publicUrl 
        }]);
        
        if (dbError) throw new Error("Database insert failed: " + dbError.message);
        
        alert("Script published to the store successfully! Check your Home Page.");
        if (typeof loadAdminProducts === 'function') loadAdminProducts(); 
    } catch (err) {
        alert(err.message);
    }
};

window.downloadCSFile = function(title, codeText) {
    let cleanCode = codeText.replace(/\\n/g, '\n').replace(/&quot;/g, '"');
    cleanCode = cleanCode.replace(/```csharp/gi, '').replace(/```cs/gi, '').replace(/```/g, '').trim();
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '') || 'CustomScript';
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(cleanCode));
    element.setAttribute('download', safeTitle + '.cs');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

// ==========================================
// 4. GENERAL UI LOGIC
// ==========================================
window.selectedPaymentMethod = null;

window.selectPayment = function(method) {
    window.selectedPaymentMethod = method;
    document.querySelectorAll('.pay-card').forEach(card => card.classList.remove('selected'));
    
    const selectedCard = document.getElementById(`card-${method}`);
    if (selectedCard) selectedCard.classList.add('selected');
    
    const nextBtn = document.getElementById('nextStepBtn');
    if (nextBtn) nextBtn.disabled = false;
};

window.showUploadStep = function() {
    if (!window.selectedPaymentMethod) return alert("Please select a payment method first.");
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('paymentForm').style.display = 'block';
    document.getElementById('circlePayment').classList.remove('active');
    document.getElementById('textPayment').classList.remove('active');
    document.getElementById('circleUpload').classList.add('active');
    document.getElementById('textUpload').classList.add('active');
};

window.showPaymentStep = function() {
    document.getElementById('paymentForm').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'block';
    document.getElementById('circleUpload').classList.remove('active');
    document.getElementById('textUpload').classList.remove('active');
    document.getElementById('circlePayment').classList.add('active');
    document.getElementById('textPayment').classList.add('active');
};

window.copyText = function(text) {
    navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard: " + text))
    .catch(() => alert("Failed to copy text. Please copy manually."));
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('folded');
};

window.switchModule = function(moduleId, clickedElement) {
    document.querySelectorAll('.admin-module').forEach(mod => mod.style.display = 'none');
    document.getElementById(moduleId).style.display = 'block';
    document.querySelectorAll('.sidebar-links li').forEach(li => li.classList.remove('active'));
    clickedElement.classList.add('active');
};

window.switchSubModule = function(sectionId, clickedElement) {
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('edit-section').style.display = 'none';
    
    document.getElementById('tab-upload').style.color = '#94a3b8';
    document.getElementById('tab-upload').style.borderBottom = '2px solid transparent';
    document.getElementById('tab-edit').style.color = '#94a3b8';
    document.getElementById('tab-edit').style.borderBottom = '2px solid transparent';
    
    document.getElementById(sectionId).style.display = 'block';
    clickedElement.style.color = '#3b82f6';
    clickedElement.style.borderBottom = '2px solid #3b82f6';
};