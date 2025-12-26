import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, onValue } from 'firebase/database';
import { auth, db, rtdbPath, RTDB_PREFIX } from '../lib/firebase';
import { CheckCircle, XCircle, RefreshCw, Database } from 'lucide-react';

export default function FirebaseTest() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [userId, setUserId] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [testData, setTestData] = useState<any>(null);
  const [realtimeTest, setRealtimeTest] = useState<any>(null);

  // Test 1: Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthStatus('connected');
        setUserId(user.uid);
      } else {
        setAuthStatus('error');
      }
    });

    return () => unsubscribe();
  }, []);

  // Test 2: Read existing data
  useEffect(() => {
    const testRef = ref(db, rtdbPath('diagnostics/connection'));
    const unsubscribe = onValue(testRef, (snapshot) => {
      setTestData(snapshot.val());
    }, (error) => {
      console.error('Read error:', error);
    });

    return () => unsubscribe();
  }, []);

  // Test 3: Write data
  const writeTestData = async () => {
    setDbStatus('writing');
    try {
      await set(ref(db, rtdbPath('diagnostics/connection')), {
        message: 'Hello from Hollywood Groove PWA!',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        uid: userId,
      });
      setDbStatus('success');
    } catch (error) {
      console.error('Write error:', error);
      setDbStatus('error');
    }
  };

  // Test 4: Real-time updates (shows/101/meta)
  useEffect(() => {
    const showRef = ref(db, rtdbPath('shows/101/meta'));
    const unsubscribe = onValue(showRef, (snapshot) => {
      setRealtimeTest(snapshot.val());
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Firebase Connection Test</h1>
          <p className="text-gray-400">Verify Firebase RTDB integration</p>
        </div>

        {/* Test 1: Authentication */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">1. Firebase Authentication</h2>
            {authStatus === 'connected' && <CheckCircle className="w-6 h-6 text-green-500" />}
            {authStatus === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
            {authStatus === 'checking' && <RefreshCw className="w-6 h-6 animate-spin text-primary" />}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={`font-semibold ${
                authStatus === 'connected' ? 'text-green-500' :
                authStatus === 'error' ? 'text-red-500' :
                'text-gray-400'
              }`}>
                {authStatus.toUpperCase()}
              </span>
            </div>
            {userId && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">User ID:</span>
                <span className="text-gray-300 font-mono text-xs">{userId.slice(0, 20)}...</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Auth Type:</span>
              <span className="text-gray-300">Anonymous</span>
            </div>
          </div>
        </div>

        {/* Test 2: Write Data */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">2. Write Test Data</h2>
            {dbStatus === 'success' && <CheckCircle className="w-6 h-6 text-green-500" />}
            {dbStatus === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Path: <code className="text-primary">{rtdbPath('diagnostics/connection')}</code>
            </p>

            <button
              onClick={writeTestData}
              disabled={dbStatus === 'writing' || authStatus !== 'connected'}
              className="w-full px-4 py-3 bg-primary text-gray-900 font-semibold rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dbStatus === 'writing' ? 'Writing...' : 'Write Test Data'}
            </button>

            {dbStatus === 'success' && (
              <div className="p-3 bg-green-500/10 border border-green-500/50 rounded text-sm text-green-400">
                ✓ Successfully wrote to Firebase RTDB
              </div>
            )}

            {dbStatus === 'error' && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-sm text-red-400">
                ✗ Failed to write. Check browser console for errors.
              </div>
            )}
          </div>
        </div>

        {/* Test 3: Read Data */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">3. Read Test Data</h2>
            {testData && <Database className="w-6 h-6 text-primary" />}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Path: <code className="text-primary">{rtdbPath('diagnostics/connection')}</code>
            </p>

            {testData ? (
              <pre className="bg-gray-950 p-4 rounded border border-gray-800 overflow-x-auto text-xs">
                {JSON.stringify(testData, null, 2)}
              </pre>
            ) : (
              <div className="p-4 bg-gray-950 border border-gray-800 rounded text-sm text-gray-500 text-center">
                No data yet. Click "Write Test Data" above.
              </div>
            )}
          </div>
        </div>

        {/* Test 4: Real-time Updates */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">4. Real-time Show Data</h2>
            {realtimeTest && <CheckCircle className="w-6 h-6 text-green-500" />}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Path: <code className="text-primary">{rtdbPath('shows/101/meta')}</code>
            </p>

            {realtimeTest ? (
              <div>
                <pre className="bg-gray-950 p-4 rounded border border-gray-800 overflow-x-auto text-xs mb-3">
                  {JSON.stringify(realtimeTest, null, 2)}
                </pre>
                <div className="p-3 bg-green-500/10 border border-green-500/50 rounded text-sm text-green-400">
                  ✓ Real-time listener active! Changes to this path will update automatically.
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-950 border border-gray-800 rounded text-sm text-gray-500 text-center">
                No show data found. Use Mac Controller to publish show 101.
              </div>
            )}
          </div>
        </div>

        {/* Firebase Config Info */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Firebase Configuration</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">RTDB Prefix:</span>
              <span className="text-gray-300 font-mono text-xs">
                {RTDB_PREFIX.length > 0 ? RTDB_PREFIX : '(none)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Project ID:</span>
              <span className="text-gray-300">theta-inkwell-448908-g9</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Database URL:</span>
              <span className="text-gray-300 text-xs">
                ...asia-southeast1.firebasedatabase.app
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Region:</span>
              <span className="text-gray-300">Asia Southeast 1 (Singapore)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
