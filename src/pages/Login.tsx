import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { GraduationCap } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-10 shadow-sm">
        <div className="mb-10 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="rounded-2xl bg-white p-3 shadow-sm border">
            <img src="/icon.png" alt="Logo" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SOS System (Beta)</h1>
          <p className="text-sm text-muted-foreground">Semesta Olympiad Squad Management System</p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/15 p-3 text-sm text-center text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <Button 
          type="button" 
          size="lg"
          className="w-full text-base font-medium h-12" 
          onClick={handleGoogleLogin} 
          disabled={loading}
          variant="default"
        >
          {loading ? (
            'Logging in...'
          ) : (
            <span className="flex items-center space-x-2">
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.73 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.78 15.72 17.56V20.31H19.28C21.36 18.39 22.56 15.58 22.56 12.25Z" fill="currentColor" />
                <path d="M12 23C14.97 23 17.46 22.02 19.28 20.31L15.72 17.56C14.74 18.23 13.48 18.64 12 18.64C9.14 18.64 6.71 16.71 5.84 14.12H2.18V16.96C3.99 20.55 7.69 23 12 23Z" fill="currentColor" />
                <path d="M5.84 14.12C5.61 13.44 5.48 12.73 5.48 12C5.48 11.27 5.61 10.56 5.84 9.88V7.04H2.18C1.43 8.52 1 10.21 1 12C1 13.79 1.43 15.48 2.18 16.96L5.84 14.12Z" fill="currentColor" />
                <path d="M12 5.36C13.62 5.36 15.07 5.92 16.22 7.02L19.35 3.89C17.45 2.12 14.97 1 12 1C7.69 1 3.99 3.45 2.18 7.04L5.84 9.88C6.71 7.29 9.14 5.36 12 5.36Z" fill="currentColor" />
              </svg>
              Continue with Google
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
