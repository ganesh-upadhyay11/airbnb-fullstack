import requests
import sys
import json
from datetime import datetime
import time

class PayDayAPITester:
    def __init__(self, base_url="https://payday-app-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.user_id = None
        self.admin_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.withdrawal_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

            print(f"   Response Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_signup(self, email, password, full_name, referral_code=None):
        """Test user signup"""
        data = {
            "email": email,
            "password": password,
            "full_name": full_name
        }
        if referral_code:
            data["referral_code"] = referral_code
            
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data=data
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True, response
        return False, response

    def test_user_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True, response
        return False, response

    def test_get_current_user(self):
        """Test get current user info"""
        if not self.token:
            print("❌ No token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return success, response

    def test_watch_ad(self):
        """Test watching an ad"""
        if not self.token:
            print("❌ No token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Watch Ad",
            "POST",
            "ads/watch",
            200,
            data={"ad_type": "video"},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return success, response

    def test_get_wallet_balance(self):
        """Test get wallet balance"""
        if not self.token:
            print("❌ No token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Get Wallet Balance",
            "GET",
            "wallet/balance",
            200,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return success, response

    def test_get_transactions(self):
        """Test get transaction history"""
        if not self.token:
            print("❌ No token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Get Transactions",
            "GET",
            "wallet/transactions",
            200,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return success, response

    def test_request_withdrawal(self, amount, payment_method, payment_id):
        """Test withdrawal request"""
        if not self.token:
            print("❌ No token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Request Withdrawal",
            "POST",
            "withdrawals/request",
            200,
            data={
                "amount": amount,
                "payment_method": payment_method,
                "payment_id": payment_id
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        if success and 'request_id' in response:
            self.withdrawal_id = response['request_id']
        return success, response

    def test_get_my_withdrawals(self):
        """Test get user's withdrawal requests"""
        if not self.token:
            print("❌ No token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Get My Withdrawals",
            "GET",
            "withdrawals/my-requests",
            200,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return success, response

    def test_admin_stats(self):
        """Test admin statistics"""
        if not self.admin_token:
            print("❌ No admin token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Admin Stats",
            "GET",
            "admin/stats",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success, response

    def test_admin_get_withdrawals(self):
        """Test admin get all withdrawals"""
        if not self.admin_token:
            print("❌ No admin token available for authentication")
            return False, {}
            
        success, response = self.run_test(
            "Admin Get Withdrawals",
            "GET",
            "admin/withdrawals",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success, response

    def test_admin_update_withdrawal(self, withdrawal_id, status, admin_notes=None):
        """Test admin update withdrawal status"""
        if not self.admin_token:
            print("❌ No admin token available for authentication")
            return False, {}
            
        data = {"status": status}
        if admin_notes:
            data["admin_notes"] = admin_notes
            
        success, response = self.run_test(
            f"Admin Update Withdrawal ({status})",
            "PUT",
            f"admin/withdrawals/{withdrawal_id}",
            200,
            data=data,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success, response

    def create_admin_user(self):
        """Create an admin user by directly modifying the database (simulation)"""
        # For testing purposes, we'll create a regular user and then assume admin privileges
        timestamp = datetime.now().strftime('%H%M%S')
        admin_email = f"admin_{timestamp}@test.com"
        admin_password = "AdminPass123!"
        
        print(f"\n🔧 Creating admin user: {admin_email}")
        success, response = self.test_user_signup(admin_email, admin_password, "Admin User")
        if success:
            self.admin_token = response['token']
            self.admin_user_id = response['user']['id']
            print("✅ Admin user created (Note: In real scenario, admin flag would need to be set in database)")
            return True
        return False

def main():
    print("🚀 Starting PayDay API Testing...")
    print("=" * 60)
    
    tester = PayDayAPITester()
    timestamp = datetime.now().strftime('%H%M%S')
    
    # Test data
    test_email = f"testuser_{timestamp}@example.com"
    test_password = "TestPass123!"
    test_full_name = "Test User"
    
    referrer_email = f"referrer_{timestamp}@example.com"
    referrer_password = "ReferrerPass123!"
    referrer_full_name = "Referrer User"
    
    print(f"📧 Test user email: {test_email}")
    print(f"📧 Referrer email: {referrer_email}")
    
    # 1. Test user signup (referrer first)
    print("\n" + "="*60)
    print("TESTING USER AUTHENTICATION")
    print("="*60)
    
    success, referrer_data = tester.test_user_signup(referrer_email, referrer_password, referrer_full_name)
    if not success:
        print("❌ Referrer signup failed, continuing without referral...")
        referral_code = None
    else:
        referral_code = referrer_data['user']['referral_code']
        print(f"✅ Referrer created with code: {referral_code}")
    
    # 2. Test user signup with referral
    success, user_data = tester.test_user_signup(test_email, test_password, test_full_name, referral_code)
    if not success:
        print("❌ User signup failed, stopping tests")
        return 1
    
    # 3. Test user login
    success, _ = tester.test_user_login(test_email, test_password)
    if not success:
        print("❌ User login failed, stopping tests")
        return 1
    
    # 4. Test get current user
    success, _ = tester.test_get_current_user()
    if not success:
        print("❌ Get current user failed")
    
    # 5. Test wallet and earning features
    print("\n" + "="*60)
    print("TESTING WALLET & EARNING FEATURES")
    print("="*60)
    
    # Get initial wallet balance
    success, initial_balance = tester.test_get_wallet_balance()
    if success:
        print(f"💰 Initial balance: ${initial_balance.get('balance', 0)}")
    
    # Watch some ads
    for i in range(3):
        print(f"\n📺 Watching ad #{i+1}...")
        success, ad_response = tester.test_watch_ad()
        if success:
            print(f"💰 Earned: ${ad_response.get('reward', 0)}")
            print(f"💰 New balance: ${ad_response.get('new_balance', 0)}")
        time.sleep(1)  # Small delay between ads
    
    # Get updated wallet balance
    success, updated_balance = tester.test_get_wallet_balance()
    if success:
        print(f"💰 Updated balance: ${updated_balance.get('balance', 0)}")
        print(f"📊 Total earned: ${updated_balance.get('total_earned', 0)}")
        print(f"📺 Ads watched: {updated_balance.get('ads_watched', 0)}")
    
    # Get transaction history
    success, transactions = tester.test_get_transactions()
    if success:
        print(f"📋 Transaction count: {len(transactions)}")
    
    # 6. Test withdrawal system
    print("\n" + "="*60)
    print("TESTING WITHDRAWAL SYSTEM")
    print("="*60)
    
    # Test withdrawal request (should fail if balance < $10)
    current_balance = updated_balance.get('balance', 0) if updated_balance else 0
    if current_balance >= 10:
        withdrawal_amount = min(10.0, current_balance)
        success, withdrawal_response = tester.test_request_withdrawal(
            withdrawal_amount, "esewa", "test_esewa_123"
        )
        if success:
            print(f"✅ Withdrawal request created: {withdrawal_response.get('request_id')}")
    else:
        # Test with insufficient balance (should fail)
        success, withdrawal_response = tester.test_request_withdrawal(
            10.0, "esewa", "test_esewa_123"
        )
        if not success:
            print("✅ Withdrawal correctly rejected due to insufficient balance")
    
    # Get withdrawal requests
    success, withdrawals = tester.test_get_my_withdrawals()
    if success:
        print(f"📋 Withdrawal requests count: {len(withdrawals)}")
    
    # 7. Test admin features (limited testing since we can't easily create admin users)
    print("\n" + "="*60)
    print("TESTING ADMIN FEATURES (LIMITED)")
    print("="*60)
    
    # Try to create admin user (this will create a regular user)
    admin_created = tester.create_admin_user()
    if admin_created:
        # Test admin endpoints (these will likely fail with 403 since user isn't actually admin)
        tester.test_admin_stats()
        tester.test_admin_get_withdrawals()
        
        # If we have a withdrawal ID, try to update it
        if tester.withdrawal_id:
            tester.test_admin_update_withdrawal(tester.withdrawal_id, "approved", "Test approval")
    
    # Print final results
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)
    print(f"📊 Tests run: {tester.tests_run}")
    print(f"✅ Tests passed: {tester.tests_passed}")
    print(f"❌ Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"📈 Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} tests failed. Check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())