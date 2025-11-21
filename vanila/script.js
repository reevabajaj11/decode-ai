document.addEventListener('DOMContentLoaded', function () {
    lucide.createIcons();
    initializeNavigation();
    initializeSmoothScroll();

    if (document.querySelector('.hero-section')) {
        initializeFileUpload();
    }
    if (document.querySelector('.dashboard')) {
        populateDashboardData();
    }
});

function initializeNavigation() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('hidden');
            mobileMenuBtn.querySelector('#menuIcon').classList.toggle('hidden');
            mobileMenuBtn.querySelector('#closeIcon').classList.toggle('hidden');
        });
    }
}

function initializeSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            const navbar = document.querySelector('.navbar');
            if (targetSection && navbar) {
                const navbarHeight = navbar.offsetHeight;
                const targetPosition = targetSection.offsetTop - navbarHeight - 60;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        });
    });
}

//home-page functions
function initializeFileUpload() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                triggerAnalysis(e.target.files[0]);
            }
        });
    }
}

function triggerAnalysis(file) {
    if (!file) return;

    sessionStorage.setItem('documentName', file.name || 'Pasted Text');

    const formData = new FormData();
    formData.append('document', file);
    showLoadingState();
    sendToBackend(formData);
}

function showLoadingState() {
    document.body.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center;"><h1>Analyzing your document...</h1><p>This might take a moment.</p></div>`;
}

function sendToBackend(formData) {
    const backendApiUrl = 'https://legaleaseai-backend-gt37.onrender.com/analyzeDocument';
    fetch(backendApiUrl, {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) { throw new Error('Network response was not ok'); }
            return response.json();
        })
        .then(data => {
            sessionStorage.setItem('analysisResult', JSON.stringify(data));
            
            sessionStorage.setItem('fullDocumentText', data.fullDocumentText);
            
            window.location.href = 'dashboard.html';
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Sorry, something went wrong. Please try again.");
            window.location.reload();
        });
}


function showProgress(elementId) {
    const titleElement = document.getElementById(elementId);
    if (!titleElement) return;

    if (titleElement.querySelector('.progress-text')) {
        return;
    }

    const progressSpan = document.createElement('span');
    progressSpan.textContent = ' (in progress)';
    progressSpan.classList.add('progress-text');
    progressSpan.style.color = '#7C3AED';
    titleElement.appendChild(progressSpan);

    return () => {
        if (progressSpan && titleElement.contains(progressSpan)) {
            titleElement.removeChild(progressSpan);
        }
    };
}

function showPasteTextModal() {
    const modalHTML = `<div class="modal-overlay"><div class="modal-content"><div class="modal-header"><h3>Paste Document Text</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div><div class="modal-body"><textarea id="pasteTextArea" class="text-area" placeholder="Paste your document text here..." rows="10"></textarea></div><div class="modal-footer"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button><button id="analyzeTextBtn" class="btn btn-primary">Analyze Text</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const cleanup = showProgress('pasteTextTitle');

    document.getElementById('analyzeTextBtn').addEventListener('click', () => {
        const text = document.getElementById('pasteTextArea').value;
        if (text.trim().length < 100) {
            alert('Please paste at least 100 characters.');
            if (cleanup) cleanup();
            return;
        }

        const file = new Blob([text], { type: 'text/plain' });

        document.querySelector('.modal-overlay').remove();
        triggerAnalysis(file);
    });
}

function showUrlModal() {
    const modalHTML = `<div class="modal-overlay"><div class="modal-content"><div class="modal-header"><h3>Analyze from URL</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div><div class="modal-body"><input type="url" class="form-input" placeholder="Enter document URL (e.g., https://example.com/privacy)" id="urlInput"></div><div class="modal-footer"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button><button id="analyzeUrlBtn" class="btn btn-primary">Analyze URL</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('analyzeUrlBtn').addEventListener('click', () => {
        const urlInput = document.getElementById('urlInput');
        const url = urlInput.value.trim();

        if (!url) {
            alert("Please enter a valid URL");
            return;
        }

        document.querySelector('.modal-overlay').remove();

        // Show Loading Screen (reuses existing function)
        showLoadingState();

        // 3. Send to Backend
        sessionStorage.setItem('documentName', url); // Use URL as the document name

        fetch('https://legaleaseai-backend-gt37.onrender.com/analyzeUrl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            sessionStorage.setItem('analysisResult', JSON.stringify(data));
            sessionStorage.setItem('fullDocumentText', data.fullDocumentText);
            
            window.location.href = 'dashboard.html';
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Failed to analyze URL. The site might be blocking bots or the URL is invalid.");
            window.location.reload();
        });
    });
}


// dashboard page functions
function populateDashboardData() {
    const resultsJSON = sessionStorage.getItem('analysisResult');
    const documentName = sessionStorage.getItem('documentName');

    if (!resultsJSON || !documentName) {
        document.body.innerHTML = "<h1>Error: No analysis data found.</h1><p><a href='index.html'>Please go back and try again.</a></p>";
        return;
    }

    const results = JSON.parse(resultsJSON);

    //Sidebar filename
    document.querySelector('.document-name').textContent = documentName;

    //Summary
    document.getElementById('summary-text').textContent = results.summary;

    //Risk Flags
    const riskContainer = document.getElementById('risk-flags-container');
    riskContainer.innerHTML = ''; // Clear "Loading..." text
    if (results.riskFlags && results.riskFlags.length > 0) {
        results.riskFlags.forEach(flag => {
            const riskLevel = flag.level.toLowerCase(); // 'red' or 'yellow'
            //tooltips
            const tooltipText = riskLevel === 'red' ? 'High Risk' : 'Medium Risk';
            const icon = riskLevel === 'red' ? 'alert-triangle' : 'alert-circle';

            riskContainer.innerHTML += `
                <div class="risk-item risk-${riskLevel}">
                    <div class="risk-indicator" data-tooltip="${tooltipText}">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="risk-content">
                        <h4 class="risk-title">${flag.title}</h4>
                        <p class="risk-description">${flag.explanation}</p>
                    </div>
                </div>`;
        });
    } else {
        riskContainer.innerHTML = '<p>No significant risks were found in this document.</p>';
    }
    //key Clauses
    const clausesContainer = document.getElementById('key-clauses-container');
    clausesContainer.innerHTML = ''; // Clear "Loading..." text
    if (results.keyClauses && results.keyClauses.length > 0) {
        results.keyClauses.forEach(clause => {
            clausesContainer.innerHTML += `<div class="accordion-item"><button class="accordion-trigger"><span class="accordion-title">${clause.title}</span><i data-lucide="chevron-down" class="accordion-icon"></i></button><div class="accordion-content"><div class="clause-comparison"><div class="clause-original"><h5>Original Legal Text:</h5><p>"${clause.originalText}"</p></div><div class="clause-explanation"><h5>Plain English:</h5><p>${clause.simplifiedText}</p></div></div></div></div>`;
        });
    }

    lucide.createIcons();
    initializeDashboardUI();
}


function initializeDashboardUI() {
    document.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', function () {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });

    //Sidebar Navigation 
    document.querySelectorAll('.sidebar-nav-item').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.sidebar-nav-item').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            const targetId = this.getAttribute('href');
            document.querySelector(targetId).classList.add('active');
        });
    });

    const sendBtn = document.getElementById('sendBtn');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    // Function to send a message
    const sendMessage = () => {
        const question = chatInput.value.trim();
        if (!question) return;

        // Add the user's message to the chat window
        chatMessages.innerHTML += `<div class="chat-message chat-user"><div class="message-content"><p>${question}</p></div></div>`;
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Get the original document text was saved earlier
        const documentText = sessionStorage.getItem('fullDocumentText');

        // Send the question and context to backend 
        fetch('https://legaleaseai-backend-gt37.onrender.com/askQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                context: documentText
            })
        })
            .then(response => response.json())
            .then(data => {
                // Add the AI's answer to the chat window
                chatMessages.innerHTML += `<div class="chat-message chat-ai"><div class="message-avatar"><i data-lucide="bot"></i></div><div class="message-content"><p>${data.answer}</p></div></div>`;
                lucide.createIcons(); 
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => console.error('Chat Error:', error));
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}