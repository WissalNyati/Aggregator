import { useState, useEffect } from 'react';
import { authApi } from '../lib/api';

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const adminStatus = await authApi.isAdmin();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    void checkAdmin();
  }, []);

  return { isAdmin, loading };
}

