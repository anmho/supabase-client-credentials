// Golang client library example for Supabase M2M token management
// This example demonstrates a thread-safe TokenManager with automatic token refresh

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// TokenResponse represents the response from the m2m-token edge function
type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope"`
}

// TokenManager manages M2M authentication tokens with automatic refresh
type TokenManager struct {
	clientID     string
	clientSecret string
	edgeFunctionURL string
	
	mu           sync.RWMutex
	token        string
	expiresAt    time.Time
	refreshTimer *time.Ticker
	
	httpClient   *http.Client
}

// NewTokenManager creates a new TokenManager instance
func NewTokenManager(clientID, clientSecret, edgeFunctionURL string) *TokenManager {
	tm := &TokenManager{
		clientID:        clientID,
		clientSecret:    clientSecret,
		edgeFunctionURL: edgeFunctionURL,
		httpClient:      &http.Client{Timeout: 10 * time.Second},
	}
	
	// Initial token acquisition
	tm.refreshToken()
	
	// Start background refresh goroutine
	go tm.startAutoRefresh()
	
	return tm
}

// GetToken returns the current access token, refreshing if necessary
func (tm *TokenManager) GetToken() (string, error) {
	tm.mu.RLock()
	token := tm.token
	expiresAt := tm.expiresAt
	tm.mu.RUnlock()
	
	// If token is expired or will expire in less than 1 minute, refresh it
	if time.Now().After(expiresAt.Add(-1 * time.Minute)) {
		if err := tm.refreshToken(); err != nil {
			return "", fmt.Errorf("failed to refresh token: %w", err)
		}
		tm.mu.RLock()
		token = tm.token
		tm.mu.RUnlock()
	}
	
	return token, nil
}

// refreshToken acquires a new token from the edge function
func (tm *TokenManager) refreshToken() error {
	// Prepare request body
	requestBody := map[string]string{
		"client_id":     tm.clientID,
		"client_secret": tm.clientSecret,
	}
	
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}
	
	// Create HTTP request
	req, err := http.NewRequest("POST", tm.edgeFunctionURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	// Execute request
	resp, err := tm.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("token request failed with status %d: %s", resp.StatusCode, string(body))
	}
	
	// Parse response
	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}
	
	// Update token and expiration time
	tm.mu.Lock()
	tm.token = tokenResp.AccessToken
	// Set expiration to 5 minutes before actual expiry to ensure we refresh in time
	tm.expiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn-300) * time.Second)
	tm.mu.Unlock()
	
	return nil
}

// startAutoRefresh runs a background goroutine that refreshes the token
// 5 minutes before expiration
func (tm *TokenManager) startAutoRefresh() {
	// Refresh immediately on startup
	tm.refreshToken()
	
	// Calculate refresh interval (5 minutes before expiration)
	tm.mu.RLock()
	expiresAt := tm.expiresAt
	tm.mu.RUnlock()
	
	refreshInterval := time.Until(expiresAt) - (5 * time.Minute)
	if refreshInterval < time.Minute {
		refreshInterval = time.Minute // Minimum 1 minute interval
	}
	
	tm.mu.Lock()
	tm.refreshTimer = time.NewTicker(refreshInterval)
	tm.mu.Unlock()
	
	for range tm.refreshTimer.C {
		if err := tm.refreshToken(); err != nil {
			fmt.Printf("Error refreshing token: %v\n", err)
			// Continue trying - don't exit the goroutine
		} else {
			// Update ticker interval for next refresh
			tm.mu.RLock()
			expiresAt := tm.expiresAt
			tm.mu.RUnlock()
			
			refreshInterval := time.Until(expiresAt) - (5 * time.Minute)
			if refreshInterval < time.Minute {
				refreshInterval = time.Minute
			}
			
			tm.mu.Lock()
			if tm.refreshTimer != nil {
				tm.refreshTimer.Stop()
			}
			tm.refreshTimer = time.NewTicker(refreshInterval)
			tm.mu.Unlock()
		}
	}
}

// Stop stops the auto-refresh goroutine
func (tm *TokenManager) Stop() {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.refreshTimer != nil {
		tm.refreshTimer.Stop()
		tm.refreshTimer = nil
	}
}

// Example usage
func main() {
	// Initialize token manager
	// Replace these with your actual credentials and edge function URL
	clientID := "your-client-id"
	clientSecret := "your-client-secret"
	edgeFunctionURL := "https://your-project.supabase.co/functions/v1/m2m-token"
	
	tm := NewTokenManager(clientID, clientSecret, edgeFunctionURL)
	defer tm.Stop()
	
	// Use the token manager in your application
	// Example: Make an authenticated request
	for i := 0; i < 5; i++ {
		token, err := tm.GetToken()
		if err != nil {
			fmt.Printf("Error getting token: %v\n", err)
			continue
		}
		
		fmt.Printf("Token acquired: %s...\n", token[:20])
		
		// Example: Use token in API request
		req, _ := http.NewRequest("GET", "https://your-api.example.com/data", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		
		// ... make your API call here
		
		time.Sleep(10 * time.Second)
	}
}

