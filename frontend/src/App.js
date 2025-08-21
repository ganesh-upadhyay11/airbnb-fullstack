import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Wallet, Play, LogOut, User, DollarSign, TrendingUp, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { useToast } from './hooks/use-toast';
import { Toaster } from './components/ui/toaster';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const signup = async (email, password, full_name, referral_code) => {
    const response = await axios.post(`${API}/auth/signup`, {
      email,
      password,
      full_name,
      referral_code
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, signup, logout, loading, token }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
      } else {
        await signup(email, password, fullName, referralCode);
        toast({
          title: "Account created!",
          description: "Welcome to PayDay! Start earning by watching ads.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-emerald-700">
            💰 PayDay
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Welcome back!' : 'Start earning money today!'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="referralCode">Referral Code (Optional)</Label>
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="Enter referral code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-emerald-600 hover:text-emerald-800"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { user, logout, token } = useAuth();
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [adWatching, setAdWatching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWalletData();
    fetchTransactions();
    fetchWithdrawals();
  }, []);

  const fetchWalletData = async () => {
    try {
      const response = await axios.get(`${API}/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWalletData(response.data);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API}/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await axios.get(`${API}/withdrawals/my-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    }
  };

  const watchAd = async () => {
    setAdWatching(true);
    try {
      // Simulate ad watching time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const response = await axios.post(`${API}/ads/watch`, 
        { ad_type: "video" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast({
        title: "Ad completed!",
        description: `You earned $${response.data.reward}!`,
      });
      
      fetchWalletData();
      fetchTransactions();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process ad reward",
      });
    } finally {
      setAdWatching(false);
    }
  };

  const requestWithdrawal = async (amount, paymentMethod, paymentId) => {
    try {
      await axios.post(`${API}/withdrawals/request`, {
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        payment_id: paymentId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast({
        title: "Withdrawal requested!",
        description: "Your withdrawal request has been submitted for review.",
      });
      
      fetchWalletData();
      fetchWithdrawals();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || "Failed to request withdrawal",
      });
    }
  };

  if (!walletData) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <Header user={user} logout={logout} />
      
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="earn" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="earn">Earn</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="earn" className="space-y-6">
            <WalletOverview walletData={walletData} />
            <AdWatchingSection adWatching={adWatching} watchAd={watchAd} />
          </TabsContent>

          <TabsContent value="wallet" className="space-y-6">
            <WalletDetails walletData={walletData} transactions={transactions} />
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-6">
            <WithdrawSection 
              walletData={walletData} 
              requestWithdrawal={requestWithdrawal}
              withdrawals={withdrawals}
            />
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <ProfileSection user={user} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Header Component
const Header = ({ user, logout }) => (
  <header className="bg-white shadow-sm border-b">
    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <h1 className="text-2xl font-bold text-emerald-700">💰 PayDay</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-600">Welcome, {user.full_name}</span>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  </header>
);

// Wallet Overview Component
const WalletOverview = ({ walletData }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">Wallet Balance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-emerald-600">
          ${walletData.balance.toFixed(2)}
        </div>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">Total Earned</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-blue-600">
          ${walletData.total_earned.toFixed(2)}
        </div>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">Ads Watched</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-purple-600">
          {walletData.ads_watched}
        </div>
      </CardContent>
    </Card>
  </div>
);

// Ad Watching Section
const AdWatchingSection = ({ adWatching, watchAd }) => (
  <Card>
    <CardHeader>
      <CardTitle>Watch Ads & Earn</CardTitle>
      <CardDescription>
        Earn $0.50 for each video ad you watch completely
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg p-6 text-white text-center">
        <Play className="w-16 h-16 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Ready to earn?</h3>
        <p className="mb-4">Watch a short video ad and earn money instantly!</p>
        <Button 
          className="bg-white text-emerald-600 hover:bg-gray-100"
          onClick={watchAd}
          disabled={adWatching}
        >
          {adWatching ? 'Watching Ad...' : 'Watch Ad Now'}
        </Button>
      </div>
      
      {adWatching && (
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-blue-700">Please wait while the ad is playing...</p>
        </div>
      )}
    </CardContent>
  </Card>
);

// Wallet Details Component
const WalletDetails = ({ walletData, transactions }) => (
  <div className="space-y-6">
    <WalletOverview walletData={walletData} />
    
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transactions yet</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{tx.description}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {tx.type.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);

// Withdraw Section Component
const WithdrawSection = ({ walletData, requestWithdrawal, withdrawals }) => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentId, setPaymentId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !paymentMethod || !paymentId) return;
    requestWithdrawal(amount, paymentMethod, paymentId);
    setAmount('');
    setPaymentMethod('');
    setPaymentId('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Request Withdrawal</CardTitle>
          <CardDescription>
            Minimum withdrawal amount is $10. Available balance: ${walletData.balance.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="10"
                max={walletData.balance}
                step="0.01"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="esewa">eSewa</SelectItem>
                  <SelectItem value="khalti">Khalti</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentId">
                {paymentMethod === 'esewa' ? 'eSewa ID' : 'Khalti ID'}
              </Label>
              <Input
                id="paymentId"
                type="text"
                placeholder={`Enter your ${paymentMethod === 'esewa' ? 'eSewa' : 'Khalti'} ID`}
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={!amount || !paymentMethod || !paymentId}>
              Request Withdrawal
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No withdrawal requests yet</p>
            ) : (
              withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">${withdrawal.amount.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">
                      {withdrawal.payment_method.toUpperCase()}: {withdrawal.payment_id}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(withdrawal.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        withdrawal.status === 'approved' ? 'default' :
                        withdrawal.status === 'rejected' ? 'destructive' : 'secondary'
                      }
                    >
                      {withdrawal.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {withdrawal.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                      {withdrawal.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {withdrawal.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Profile Section Component
const ProfileSection = ({ user }) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Full Name</Label>
          <Input value={user.full_name} disabled />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={user.email} disabled />
        </div>
        <div>
          <Label>Referral Code</Label>
          <div className="flex space-x-2">
            <Input value={user.referral_code} disabled />
            <Button 
              variant="outline" 
              onClick={() => navigator.clipboard.writeText(user.referral_code)}
            >
              Copy
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Share this code with friends. You'll earn $5 for each successful referral!
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Account Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-emerald-50 rounded-lg">
            <DollarSign className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
            <p className="text-2xl font-bold text-emerald-600">${user.total_earned.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Total Earned</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Play className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-blue-600">{user.ads_watched}</p>
            <p className="text-sm text-gray-600">Ads Watched</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

// Admin Dashboard (if user is admin)
const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (user.is_admin) {
      fetchAdminStats();
      fetchWithdrawals();
    }
  }, [user]);

  const fetchAdminStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await axios.get(`${API}/admin/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    }
  };

  const updateWithdrawal = async (withdrawalId, status, notes = '') => {
    try {
      await axios.put(`${API}/admin/withdrawals/${withdrawalId}`, {
        status,
        admin_notes: notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast({
        title: `Withdrawal ${status}!`,
        description: `The withdrawal request has been ${status}.`,
      });
      
      fetchWithdrawals();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update withdrawal status",
      });
    }
  };

  if (!user.is_admin) {
    return <Navigate to="/" />;
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.total_users}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Withdrawals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {stats.total_withdrawals}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.pending_withdrawals}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ads Watched</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.total_ads_watched}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {withdrawals.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No withdrawal requests</p>
            ) : (
              withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="border p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{withdrawal.user_name}</p>
                      <p className="text-sm text-gray-600">{withdrawal.user_email}</p>
                      <p className="text-lg font-bold text-emerald-600">
                        ${withdrawal.amount.toFixed(2)}
                      </p>
                      <p className="text-sm">
                        {withdrawal.payment_method.toUpperCase()}: {withdrawal.payment_id}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requested: {new Date(withdrawal.requested_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        withdrawal.status === 'approved' ? 'default' :
                        withdrawal.status === 'rejected' ? 'destructive' : 'secondary'
                      }
                    >
                      {withdrawal.status}
                    </Badge>
                  </div>
                  
                  {withdrawal.status === 'pending' && (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => updateWithdrawal(withdrawal.id, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateWithdrawal(withdrawal.id, 'rejected', 'Rejected by admin')}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  
                  {withdrawal.admin_notes && (
                    <div className="bg-gray-50 p-2 rounded text-sm">
                      <strong>Admin Notes:</strong> {withdrawal.admin_notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppContent />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div>
      <Dashboard />
      {user.is_admin && (
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Panel</h2>
          <AdminDashboard />
        </div>
      )}
    </div>
  );
};

export default App;