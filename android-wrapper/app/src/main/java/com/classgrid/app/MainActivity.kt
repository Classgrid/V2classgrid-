package com.classgrid.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricPrompt
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val KEY_NAME = "ClassgridBiometricKey"
    private lateinit var prefs: SharedPreferences

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("ClassgridPrefs", Context.MODE_PRIVATE)
        webView = findViewById(R.id.webView)
        
        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.useWideViewPort = true
        webSettings.loadWithOverviewMode = true
        
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString()?.lowercase() ?: ""
                
                if (url.contains("super-admin") || 
                    url.contains("org-admin") || 
                    url.contains("admin-login") ||
                    url.contains("superadmin")) {
                    Toast.makeText(this@MainActivity, "Admin access is restricted on the mobile app.", Toast.LENGTH_SHORT).show()
                    return true
                }
                
                // Intercept Google OAuth and open in secure Custom Chrome Tab
                if (url.contains("/api/auth/google") && !url.contains("callback")) {
                    val customTabsIntent = CustomTabsIntent.Builder().build()
                    val authUrl = "$url${if (url.contains("?")) "&" else "?"}android=true"
                    customTabsIntent.launchUrl(this@MainActivity, Uri.parse(authUrl))
                    return true
                }
                
                return false
            }
        }

        // Add JavaScript Bridge to connect the Web App with Native Kotlin
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidApp")

        webView.loadUrl("https://v2.classgrid.in/login") 

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
        
        // Handle initial intent if app was launched via deep link
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action = intent?.action
        val data = intent?.data
        
        if (Intent.ACTION_VIEW == action && data != null && data.scheme == "classgridapp") {
            // We just returned from the Google Custom Tab
            val token = data.getQueryParameter("token")
            val target = data.getQueryParameter("target") ?: "/classroom.html"
            if (token != null) {
                // Set the token securely in the WebView's localStorage and cookies
                val cookieManager = CookieManager.getInstance()
                cookieManager.setCookie("https://v2.classgrid.in", "jwt=$token; Path=/; HttpOnly")
                
                // Inject token into localStorage and redirect to dashboard
                webView.evaluateJavascript("localStorage.setItem('token', '$token'); window.location.href = '$target';", null)
            }
        }
    }

    // 1. Get or Create Unique Hardware Device ID
    private fun getHardwareDeviceId(): String {
        var id = prefs.getString("DEVICE_ID", null)
        if (id == null) {
            id = UUID.randomUUID().toString()
            prefs.edit().putString("DEVICE_ID", id).apply()
        }
        return id
    }

    // 2. Generate Biometric Cryptographic KeyPair
    private fun generateSecretKey() {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        if (!keyStore.containsAlias(KEY_NAME)) {
            val keyPairGenerator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
            keyPairGenerator.initialize(
                KeyGenParameterSpec.Builder(
                    KEY_NAME,
                    KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
                )
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(true) // Forces Biometric prompt to unlock
                .build()
            )
            keyPairGenerator.generateKeyPair()
        }
    }

    // 3. Get Public Key in Base64 (to save in MongoDB)
    private fun getPublicKeyString(): String {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        val publicKey = keyStore.getCertificate(KEY_NAME).publicKey
        return Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
    }

    // --- JAVASCRIPT INTERFACE ---
    inner class WebAppInterface(private val context: Context) {
        
        // Expose to JS: window.AndroidApp.getHardwareDeviceId()
        @JavascriptInterface
        fun getHardwareDeviceId(): String {
            return this@MainActivity.getHardwareDeviceId()
        }

        // Expose to JS: window.AndroidApp.registerDevice()
        @JavascriptInterface
        fun registerDevice(setupToken: String) {
            generateSecretKey()
            
            val executor = ContextCompat.getMainExecutor(context)
            val biometricPrompt = BiometricPrompt(this@MainActivity, executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        val deviceId = getHardwareDeviceId()
                        val publicKey = getPublicKeyString()
                        
                        // Send data back to Web JS
                        runOnUiThread {
                            val script = "javascript:onDeviceRegistered(true, null, '$deviceId', '$publicKey');"
                            webView.evaluateJavascript(script, null)
                        }
                    }
                    
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        runOnUiThread {
                            webView.evaluateJavascript("javascript:onDeviceRegistered(false, '$errString', null, null);", null)
                        }
                    }
                })

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Secure Device Registration")
                .setSubtitle("Link this device to your Classgrid account")
                .setNegativeButtonText("Cancel")
                .build()

            runOnUiThread {
                biometricPrompt.authenticate(promptInfo)
            }
        }

        // Expose to JS: window.AndroidApp.signChallenge()
        @JavascriptInterface
        fun signChallenge(challenge: String, callbackName: String) {
            val executor = ContextCompat.getMainExecutor(context)
            
            try {
                val keyStore = KeyStore.getInstance("AndroidKeyStore")
                keyStore.load(null)
                val privateKey = keyStore.getKey(KEY_NAME, null) as java.security.PrivateKey
                
                val signature = Signature.getInstance("SHA256withECDSA")
                signature.initSign(privateKey)
                
                val cryptoObject = BiometricPrompt.CryptoObject(signature)

                val biometricPrompt = BiometricPrompt(this@MainActivity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            val sig = result.cryptoObject?.signature
                            if (sig != null) {
                                sig.update(challenge.toByteArray())
                                val signatureBytes = sig.sign()
                                val signatureBase64 = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)
                                val deviceId = getHardwareDeviceId()
                                
                                runOnUiThread {
                                    webView.evaluateJavascript("javascript:$callbackName(true, null, '$deviceId', '$signatureBase64');", null)
                                }
                            }
                        }
                        
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            runOnUiThread {
                                webView.evaluateJavascript("javascript:$callbackName(false, '$errString', null, null);", null)
                            }
                        }
                    })

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Verify Identity")
                    .setSubtitle("Confirm it's you to mark attendance")
                    .setNegativeButtonText("Cancel")
                    .build()

                runOnUiThread {
                    biometricPrompt.authenticate(promptInfo, cryptoObject)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    webView.evaluateJavascript("javascript:$callbackName(false, 'Biometric setup missing or invalid', null, null);", null)
                }
            }
        }
    }
}
