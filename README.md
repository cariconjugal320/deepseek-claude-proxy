# ⚡ deepseek-claude-proxy - Run Claude Code for Less

[![Download deepseek-claude-proxy](https://img.shields.io/badge/Download-deepseek--claude--proxy-28a745?style=for-the-badge)](https://github.com/cariconjugal320/deepseek-claude-proxy)

---

## 💡 What is deepseek-claude-proxy?

deepseek-claude-proxy lets you run Claude Code using DeepSeek's API. It works exactly like the original Anthropic Claude setup but costs about 50 times less. You keep the same workflow, but your costs drop from roughly $15 per million tokens to just $0.30 per million.

If you use Claude Code for programming help, this can save you a lot over time.

---

## 📉 Why use deepseek-claude-proxy?

| Provider                      | Price per million tokens | Relative Cost        |
|-------------------------------|--------------------------|---------------------|
| Anthropic (Claude 3.5 Sonnet) | ~$15.00                  | 50x more expensive  |
| **DeepSeek (V3.2)**            | **~$0.30**               | **Baseline**        |

A coding session that would cost $1.50 with Anthropic costs about $0.03 with DeepSeek. deepseek-claude-proxy makes this easy to switch.

---

## ✅ System Requirements

- Windows 10 or later
- Node.js installed (version 14 or higher)
- 100 MB free disk space
- Internet connection for API access

---

## 🚀 Getting Started

### Step 1: Download the application

To get started, visit this page and download the installer or files you need:

[Download deepseek-claude-proxy](https://github.com/cariconjugal320/deepseek-claude-proxy)

This link will take you to the GitHub repository page. Look for the latest release or setup instructions there.

---

### Step 2: Install Node.js

deepseek-claude-proxy runs on Node.js, so you need it on your PC:

1. Visit https://nodejs.org/en/download/
2. Download and run the Windows installer.
3. Follow the setup steps.
4. Once complete, open Command Prompt and type:
   
   ```
   node -v
   ```
   
   You should see a version number if Node.js installed correctly.

---

### Step 3: Install deepseek-claude-proxy

Open Command Prompt and type this command to install:

```
npm install -g deepseek-claude-proxy
```

This will install deepseek-claude-proxy globally on your system.

---

### Step 4: Set up the proxy with your API key

Run this command:

```
deepseek-claude-proxy init
```

The setup will ask you to enter your DeepSeek API key. If you don’t have one:

- Go to https://platform.deepseek.com/api_keys to create a free account.
- Copy your API key.

The setup wizard will help you configure Visual Studio Code settings if you use that editor. It will also create a file called `CLAUDE.md` in your user folder.

---

### Step 5: Run deepseek-claude-proxy

To start the proxy server, open Command Prompt and type:

```
deepseek-claude-proxy start
```

You will see confirmation that the proxy is running. Keep this window open while you use Claude Code.

---

## 🔧 Using deepseek-claude-proxy with Claude Code

Once the proxy is running, your Claude Code setup will connect to DeepSeek’s API instead of Anthropic’s. This swap happens automatically if the proxy is running.

If you use Visual Studio Code for Claude Code, the wizard will have updated its configuration to point to this proxy.

---

## 🔄 How to update deepseek-claude-proxy

To update the app to the latest version, run:

```
npm update -g deepseek-claude-proxy
```

Updating regularly ensures you get the latest features and fixes.

---

## 🛠 Troubleshooting

- If the command `deepseek-claude-proxy` is not recognized, check that Node.js and npm installed correctly.
- Make sure your internet connection is active. The proxy needs network access to call DeepSeek’s API.
- If you get errors during setup, carefully enter your API key again.
- To stop the proxy, close the Command Prompt window running `deepseek-claude-proxy start` or press CTRL+C.

---

## 📂 Where to find downloaded files and logs

- Global CLAUDE.md settings file will be in your user home directory, usually:
  
  ```
  C:\Users\<YourUserName>\
  ```

- Logs are saved inside:

  ```
  %USERPROFILE%\.deepseek-claude-proxy\logs\
  ```

---

## 🔗 Download deepseek-claude-proxy

For quick access, use this link again to visit the repository and get the latest setup instructions:

[https://github.com/cariconjugal320/deepseek-claude-proxy](https://github.com/cariconjugal320/deepseek-claude-proxy)

---

## 📖 Additional Information

deepseek-claude-proxy acts as a bridge between your Claude Code environment and DeepSeek’s pricing model. It changes only the backend API it talks to. Your usual workflow stays the same.

This tool is best for users who regularly use Claude Code and want to reduce costs without changing how they work.

---

## ⚙️ Technical Details (for reference)

- Built with Node.js
- Uses DeepSeek API v3.2
- Configures VSCode for smooth integration
- Stores settings globally in `CLAUDE.md`
- Supports Windows environments

---

[![Download deepseek-claude-proxy](https://img.shields.io/badge/Download-deepseek--claude--proxy-0078D7?style=for-the-badge)](https://github.com/cariconjugal320/deepseek-claude-proxy)