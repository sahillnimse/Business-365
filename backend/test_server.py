#!/usr/bin/env python3
"""
Test script to verify the backend API endpoints work correctly
"""
import sys
import os
sys.path.append('.')

import requests
import time

def test_backend():
    # Start the backend server
    import subprocess
    import threading
    
    server = subprocess.Popen([
        sys.executable, 'main.py'
    ], cwd='backend')
    
    try:
        # Wait for server to start
        time.sleep(3)
        
        # Test health endpoint
        try:
            response = requests.get('http://localhost:8000/health', timeout=5)
            print(f"Health endpoint: {response.status_code}")
            if response.status_code == 200:
                print("SUCCESS: Health check passed")
                print(f"Response: {response.json()}")
            else:
                print(f"ERROR: Health check failed: {response.text}")
        except Exception as e:
            print(f"ERROR: Health check error: {e}")
        
        # Test items endpoint (without auth for now)
        try:
            response = requests.get('http://localhost:8000/items', timeout=5)
            print(f"Items endpoint: {response.status_code}")
            if response.status_code == 401:
                print("SUCCESS: Items endpoint properly protected (requires auth)")
            elif response.status_code == 200:
                print("SUCCESS: Items endpoint working")
            else:
                print(f"ERROR: Items endpoint unexpected status: {response.text}")
        except Exception as e:
            print(f"ERROR: Items endpoint error: {e}")
        
        # Test validation endpoint
        try:
            response = requests.get('http://localhost:8000/validate', timeout=5)
            print(f"Validation endpoint: {response.status_code}")
            if response.status_code == 401:
                print("SUCCESS: Validation endpoint properly protected (requires auth)")
            else:
                print(f"INFO: Validation endpoint status: {response.status_code}")
        except Exception as e:
            print(f"ERROR: Validation endpoint error: {e}")
            
    finally:
        # Clean up
        server.terminate()
        server.wait()
        print("Backend server stopped")

if __name__ == '__main__':
    test_backend()