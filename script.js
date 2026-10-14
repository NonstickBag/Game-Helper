// ==========================================
// 1. INITIALIZE SUPABASE
// ==========================================
const supabaseUrl = 'https://ezhyiguhutkkvymcfkpj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6aHlpZ3VodXRra3Z5bWNma3BqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwODU3MDgsImV4cCI6MjEwNjY2MTcwOH0.hUqs8TXz3FL3aEW14y0dHqCYZk4e_xW23-Kdapu_QF0'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Helper to pack/unpack receipt & approval metadata inside description without needing SQL changes
const META_DELIM = '|||META:';
function parseRequestMeta(rawDesc) {
    if (!rawDesc) return { cleanDesc: '', meta: {} };
    const idx = rawDesc.indexOf(META_DELIM);
    if (idx === -1) return { cleanDesc: rawDesc, meta: {} };
    const cleanDesc = rawDesc.substring(0, idx);
    try {
        const meta = JSON.parse(rawDesc.substring(idx + META_DELIM.length));
        return { cleanDesc, meta };
    } catch (e) {
        return { cleanDesc, meta: {} };
    }
}

function buildRequestDesc(cleanDesc, metaObj) {
    return `${cleanDesc}${META_DELIM}${JSON.stringify(metaObj)}`;
}

// ==========================================
// 2. MAIN EVENT LISTENER (Handles all pages)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- Light/Dark Mode Memory & Toggle ---
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    const moonIcon = `<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />`;
    const sunIcon = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-2.259-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />`;

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        if (themeIcon) themeIcon.innerHTML = sunIcon;
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            if (document.body.classList.contains('light-mode')) {
                localStorage.setItem('theme', 'light');
                themeIcon.innerHTML = sunIcon;
            } else {
                localStorage.setItem('theme', 'dark');
                themeIcon.innerHTML = moonIcon;
            }
        });
    }

    // --- Password Hide/Show Toggle ---
    const openEyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
    const closedEyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>`;

    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.innerHTML = openEyeSvg;
            } else {
                input.type = 'password';
                this.innerHTML = closedEyeSvg;
            }
        });
    });

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

    // --- Payment Page (Manual Admin Verification Flow) ---
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
            
            const submitBtn = paymentForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Uploading Receipt...';
            submitBtn.disabled = true;

            try {
                // 1. Upload receipt image to Supabase Storage and get public URL
                let receiptUrl = '';
                const fileInput = document.getElementById('receiptFile');
                if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
                    const fileName = `receipts/${Date.now()}_${safeName}`;
                    const { error: upErr } = await supabaseClient.storage.from('unity-scripts').upload(fileName, file);
                    if (upErr) throw new Error("Receipt upload failed: " + upErr.message);

                    const { data: pubData } = supabaseClient.storage.from('unity-scripts').getPublicUrl(fileName);
                    receiptUrl = pubData.publicUrl;
                }

                // 2. Save receipt & set status to 'processing' so Admin can Approve or Disapprove
                if (isRequest && item) {
                    const { cleanDesc, meta } = parseRequestMeta(item.description);
                    meta.receiptUrl = receiptUrl;
                    meta.disapproved = false;
                    meta.paymentMethod = window.selectedPaymentMethod || 'manual';

                    const updatedDesc = buildRequestDesc(cleanDesc, meta);
                    const { error } = await supabaseClient
                        .from('requests')
                        .update({ status: 'processing', description: updatedDesc })
                        .eq('id', item.id);
                    if (error) throw new Error(error.message);
                } else if (item) {
                    // Store Product purchase -> create a request record so Admin can Approve/Disapprove it
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (!session) throw new Error("Please log in to complete your purchase.");

                    const meta = {
                        receiptUrl: receiptUrl,
                        fileUrl: item.file_url,
                        isStorePurchase: true,
                        disapproved: false,
                        paymentMethod: window.selectedPaymentMethod || 'manual'
                    };
                    const updatedDesc = buildRequestDesc(item.description, meta);

                    const { error } = await supabaseClient.from('requests').insert([{
                        user_id: session.user.id,
                        title: `[Store] ${item.name}`,
                        description: updatedDesc,
                        complexity: 'simple',
                        estimated_price: item.price,
                        auto_generated_code: '',
                        status: 'processing'
                    }]);
                    if (error) throw new Error(error.message);
                }

                // 3. Show Step 3 Pending Approval Screen
                document.getElementById('paymentFormContainer').style.display = 'none';
                document.getElementById('paymentSuccess').style.display = 'block';
            } catch (err) {
                alert(err.message);
                submitBtn.textContent = 'CONFIRM';
                submitBtn.disabled = false;
            }
        });
    }

    // --- My Requests Page (User View) ---
    const myRequestsList = document.getElementById('myRequestsList');
    if (myRequestsList) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const { data: reqs, error } = await supabaseClient.from('requests').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
            
            if (error) myRequestsList.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
            else if (reqs.length === 0) myRequestsList.innerHTML = `<p style="color: #94a3b8;">You haven't requested or purchased any scripts yet.</p>`;
            else {
                myRequestsList.innerHTML = '';
                reqs.forEach(req => {
                    const { cleanDesc, meta } = parseRequestMeta(req.description);
                    const isDisapproved = req.status === 'awaiting_payment' && meta.disapproved;

                    let badgeColor = '';
                    let badgeText = req.status.replace('_', ' ');

                    if (isDisapproved) {
                        badgeColor = 'background-color: #ef444420; color: #f87171; border: 1px solid #ef4444;';
                        badgeText = 'payment disapproved';
                    } else if (req.status === 'awaiting_payment') {
                        badgeColor = 'background-color: #8b5cf620; color: #a78bfa;';
                    } else if (req.status === 'pending') {
                        badgeColor = 'background-color: #f59e0b20; color: #fbbf24;';
                    } else if (req.status === 'completed') {
                        badgeColor = 'background-color: #22c55e20; color: #4ade80;';
                        badgeText = 'approved & completed';
                    } else if (req.status === 'processing') {
                        badgeColor = 'background-color: #3b82f620; color: #60a5fa;';
                        badgeText = meta.receiptUrl ? 'pending admin approval' : 'processing';
                    }
                    
                    let actionHtml = '';
                    if (isDisapproved) {
                        actionHtml = `
                            <p style="color: #ef4444; font-size: 0.9rem; font-weight: bold; margin-bottom: 0.75rem;">
                                ✕ Your payment receipt was disapproved by the admin. Please upload a valid transaction receipt.
                            </p>
                            <button class="dl-btn" style="background-color: #ef4444;" onclick="window.location.href='payment.html?req_id=${req.id}'">
                                💳 Re-upload Payment Receipt ($${req.estimated_price})
                            </button>
                        `;
                    } else if (req.status === 'awaiting_payment') {
                        actionHtml = `<button class="dl-btn" style="background-color: #8b5cf6;" onclick="window.location.href='payment.html?req_id=${req.id}'">💳 Pay $${req.estimated_price} to Unlock</button>`;
                    } else if (req.status === 'processing' && meta.receiptUrl) {
                        actionHtml = `<p style="color: #60a5fa; font-size: 0.9rem; font-weight: bold;">⏳ Receipt uploaded! Waiting for admin payment approval to unlock download.</p>`;
                    } else if (req.status === 'completed') {
                        if (req.auto_generated_code && req.auto_generated_code.trim() !== '') {
                            const safeCode = req.auto_generated_code.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, "\\n");
                            actionHtml = `<button class="dl-btn" onclick="downloadCSFile('${req.title}', '${safeCode}')">⬇️ Download Script (.cs)</button>`;
                        } else if (meta.fileUrl) {
                            actionHtml = `<button class="dl-btn" onclick="window.open('${meta.fileUrl}', '_blank')">⬇️ Download Script (.cs)</button>`;
                        } else {
                            actionHtml = `<p style="color: #22c55e; font-size: 0.9rem; font-weight: bold;">✓ Payment Approved! Check the store catalog or contact admin for delivery.</p>`;
                        }
                    }

                    const card = document.createElement('div');
                    card.className = 'request-card';
                    card.innerHTML = `
                        <div class="req-header">
                            <div>
                                <h3 style="margin-bottom: 0.5rem; color: white;">${req.title}</h3>
                                <span style="color: #94a3b8; font-size: 0.9rem;">Complexity: <strong style="color: white; text-transform: capitalize;">${req.complexity}</strong> | Price: <strong style="color: white;">$${req.estimated_price}</strong></span>
                            </div>
                            <span class="status-badge" style="padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.85rem; font-weight: bold; text-transform: uppercase; ${badgeColor}">${badgeText}</span>
                        </div>
                        <p style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">${cleanDesc}</p>
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
        loadAdminRequests();
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
            usersList.innerHTML = `<p class="muted-text">No users found.</p>`;
        } else {
            usersList.innerHTML = ''; 
            users.forEach(user => {
                const row = document.createElement('div');
                row.className = 'user-row';
                row.innerHTML = `
                    <div>
                        <strong>${user.full_name}</strong>
                        <div style="font-size: 0.8rem; color: #888;">ID: ${user.id}</div>
                    </div>
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <select id="role-${user.id}" class="status-select">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <button onclick="updateUserRole('${user.id}')" class="btn-save-status">Save</button>
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

// --- Load Admin Requests & Payment Approvals ---
window.loadAdminRequests = async function() {
    const adminReqList = document.getElementById('adminRequestsList');
    if (!adminReqList) return;

    const { data: reqs, error } = await supabaseClient.rpc('get_all_requests_admin');
    if (error) {
        adminReqList.innerHTML = `<p style="color: #ef4444;">Error loading requests: ${error.message}</p>`;
    } else if (!reqs || reqs.length === 0) {
        adminReqList.innerHTML = `<p class="muted-text">No custom requests or payments found.</p>`;
    } else {
        adminReqList.innerHTML = '';
        reqs.forEach(req => {
            const { cleanDesc, meta } = parseRequestMeta(req.description);
            const card = document.createElement('div');
            card.className = 'admin-req-card';
            
            let codeSection = '';
            let publishBtn = ''; 
            
            if (req.auto_generated_code) {
                codeSection = `
                    <details class="code-details">
                        <summary class="code-summary">View AI Code</summary>
                        <pre class="code-pre">${req.auto_generated_code}</pre>
                    </details>
                `;
                publishBtn = `<button onclick="publishToStore(${req.req_id})" class="btn-publish">🛒 Publish to Store</button>`;
            }

            // Show Receipt Box if the user uploaded a payment screenshot
            let receiptSection = '';
            if (meta.receiptUrl) {
                receiptSection = `
                    <div class="receipt-box">
                        <div class="receipt-header">
                            <span class="receipt-title">🧾 Payment Receipt (${(meta.paymentMethod || 'Transfer').toUpperCase()})</span>
                            <a href="${meta.receiptUrl}" target="_blank" class="receipt-link">Open Full Image ↗</a>
                        </div>
                        <img src="${meta.receiptUrl}" alt="Payment Receipt" class="receipt-img">
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="admin-req-header">
                    <h3>${req.title}</h3>
                    <span class="muted-text" style="font-size: 0.85rem;">${new Date(req.created_at).toLocaleDateString()}</span>
                </div>
                <p class="admin-req-meta">
                    From: <strong>${req.user_name}</strong> | Comp: <strong>${req.complexity}</strong> | <strong>$${req.estimated_price}</strong>
                    ${meta.disapproved ? ' | <span style="color: #ef4444; font-weight: bold;">[DISAPPROVED]</span>' : ''}
                </p>
                <p class="admin-req-desc">${cleanDesc}</p>
                ${receiptSection}
                ${codeSection}
                <div class="admin-req-actions">
                    <button onclick="handlePaymentDecision(${req.req_id}, 'approve')" class="btn-Approve">✓ Approve</button>
                    <button onclick="handlePaymentDecision(${req.req_id}, 'disapprove')" class="btn-Disapprove">✕ Disapprove</button>
                    
                    <select id="status-${req.req_id}" class="status-select">
                        <option value="pending" ${req.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="processing" ${req.status === 'processing' ? 'selected' : ''}>Processing (Waiting Approval)</option>
                        <option value="awaiting_payment" ${req.status === 'awaiting_payment' ? 'selected' : ''}>Awaiting Payment</option>
                        <option value="completed" ${req.status === 'completed' ? 'selected' : ''}>Completed (Approved)</option>
                    </select>
                    <button onclick="updateRequestStatus(${req.req_id})" class="btn-save-status">Save Status</button>
                    ${publishBtn}
                </div>
            `;
            adminReqList.appendChild(card);
        });
    }
};

// --- Approve / Disapprove Handler ---
window.handlePaymentDecision = async function(reqId, decision) {
    try {
        const { data: reqData, error: fetchErr } = await supabaseClient
            .from('requests')
            .select('description')
            .eq('id', reqId)
            .single();

        if (fetchErr || !reqData) throw new Error("Could not find request record.");

        const { cleanDesc, meta } = parseRequestMeta(reqData.description);
        let newStatus = 'completed';

        if (decision === 'approve') {
            meta.disapproved = false;
            newStatus = 'completed';
        } else {
            meta.disapproved = true;
            newStatus = 'awaiting_payment';
        }

        const updatedDesc = buildRequestDesc(cleanDesc, meta);
        const { data, error } = await supabaseClient
            .from('requests')
            .update({ status: newStatus, description: updatedDesc })
            .eq('id', reqId)
            .select();

        if (error) throw new Error(error.message);
        if (!data || data.length === 0) throw new Error("Update blocked by database permissions.");

        if (decision === 'approve') {
            alert("✓ Payment Approved! The download is now unlocked for the user.");
        } else {
            alert("✕ Payment Disapproved. The download remains locked and the user has been asked to re-upload a valid receipt.");
        }

        loadAdminRequests();
    } catch (err) {
        alert("Error: " + err.message);
    }
};

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
    else {
        alert("Status updated successfully!");
        loadAdminRequests();
    }
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
        editList.innerHTML = `<p class="muted-text">No scripts uploaded yet.</p>`;
        return;
    }

    editList.innerHTML = '';
    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'admin-list-item';
        div.innerHTML = `
            <div>
                <h4 style="margin: 0 0 0.25rem 0;">${p.name}</h4>
                <span class="muted-text" style="font-size: 0.85rem;">Price: $${p.price}</span>
            </div>
            <button onclick="openEditModal(${p.id})" class="btn-save-status">Edit</button>
        `;
        editList.appendChild(div);
    });
};

window.openEditModal = async function(id) {
    const numericId = parseInt(id);
    const { data: p } = await supabaseClient.from('products').select('*').eq('id', numericId).single();
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

        const { cleanDesc } = parseRequestMeta(req.description);

        const priceInput = prompt(`Edit the store price (USD) for "${req.title}":`, req.estimated_price);
        if (priceInput === null) return; 

        const finalPrice = parseFloat(priceInput);
        if (isNaN(finalPrice) || finalPrice < 0) throw new Error("Invalid price. Publishing cancelled.");

        const descInput = prompt(`Edit the description for "${req.title}":`, cleanDesc);
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
    
    document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(sectionId).style.display = 'block';
    clickedElement.classList.add('active');
};