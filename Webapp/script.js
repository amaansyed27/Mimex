// Constants for personality prompts
const PERSONALITY_PROMPTS = {
    default: "You are a helpful AI assistant.",
    teacher: "You are a patient and knowledgeable teacher. Explain concepts clearly and provide examples.",
    coder: "You are a coding assistant. Provide clear code examples, explanations, and best practices.",
    therapist: "You are a supportive and empathetic listener. Help users process their thoughts and feelings."
};

// State management
let apiKey = '';
let currentPersonality = 'default';
let customInstructions = '';

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved API key
    apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        showApiKeyModal();
    }

    // Initialize markdown renderer
    marked.setOptions({
        highlight: function(code, language) {
            if (language && hljs.getLanguage(language)) {
                return hljs.highlight(code, { language: language }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        langPrefix: 'hljs language-',
    });

    // Add enter key handler for input
    document.getElementById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

function showApiKeyModal() {
    document.getElementById('apiKeyModal').style.display = 'flex';
}

function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    apiKey = input.value.trim();
    
    if (apiKey) {
        localStorage.setItem('geminiApiKey', apiKey);
        document.getElementById('apiKeyModal').style.display = 'none';
    } else {
        alert('Please enter a valid API key');
    }
}

function updateSettings() {
    currentPersonality = document.getElementById('personalitySelect').value;
    customInstructions = document.getElementById('customPrompt').value;
    
    // Show confirmation message
    const message = {
        role: 'system',
        content: `Settings updated! Now acting as: ${currentPersonality}`
    };
    appendMessage(message);
}

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    
    if (!message) return;

    // Append user message
    appendMessage({ role: 'user', content: message });
    userInput.value = '';

    try {
        // Prepare the prompt with personality and custom instructions
        const systemPrompt = customInstructions || PERSONALITY_PROMPTS[currentPersonality];
        const response = await fetchGeminiResponse(systemPrompt, message);
        
        // Append AI response
        appendMessage({ role: 'assistant', content: response });
    } catch (error) {
        appendMessage({ 
            role: 'system', 
            content: `Error: ${error.message}. Please check your API key and try again.` 
        });
    }
}

async function fetchGeminiResponse(systemPrompt, userMessage) {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    
    // Updated payload structure according to Gemini API requirements
    const payload = {
        contents: [{
            parts: [{
                text: `${systemPrompt}\n\nUser: ${userMessage}`
            }]
        }],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        },
        safetySettings: [{
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }]
    };

    try {
        const response = await fetch(`${endpoint}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        
        // Check if we have a valid response
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format from API');
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('API Error:', error);
        if (error.message.includes('API key')) {
            throw new Error('Invalid API key. Please check your API key and try again.');
        } else {
            throw new Error(`Failed to get response: ${error.message}`);
        }
    }
}

function appendMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}-message`;
    
    // Process markdown if it's an AI message
    if (message.role === 'assistant') {
        messageDiv.innerHTML = marked.parse(message.content);
        // Initialize syntax highlighting for code blocks
        messageDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
    } else {
        messageDiv.textContent = message.content;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add error handling for API key validation
function validateApiKey(key) {
    // Basic validation - check if it's a non-empty string
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
        return false;
    }
    // Check if it matches the expected format (you may want to adjust this)
    return /^AIza[0-9A-Za-z-_]{35}$/.test(key.trim());
}