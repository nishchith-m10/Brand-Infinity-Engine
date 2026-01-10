"use client";

import { useState, useEffect } from 'react';
import { useAuth } from "@/lib/auth/auth-provider";
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from '@/lib/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';

export default function AccountPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const { toasts, showToast, dismissToast } = useToast();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Initialize fullName from user metadata
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Delete account state
  const [isDeleting, setIsDeleting] = useState(false);

  const handleProfileSave = async () => {
    if (!fullName.trim()) {
      showToast({ type: 'error', message: 'Please enter your full name' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });
      
      if (error) throw error;
      
      showToast({ type: 'success', message: 'Profile updated successfully' });
    } catch (error) {
      console.error('Profile save error:', error);
      showToast({ type: 'error', message: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      // Call backend to delete account
      const response = await fetch('/api/v1/auth/delete-account', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to delete account' });
      setIsDeleting(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast({ type: 'error', message: 'Please fill in all password fields' });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({ type: 'error', message: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      showToast({ type: 'error', message: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);

    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        showToast({ type: 'error', message: 'Current password is incorrect' });
        setLoading(false);
        return;
      }

      // Update to new password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      showToast({ type: 'success', message: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-3xl m-4 flex-1 shadow-sm border border-slate-100/50 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Account Management
          </h1>
          <p className="text-slate-500 mt-2">Manage your personal details and security settings.</p>
        </div>
      </motion.div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-lamaPurple" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal account details here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ''} disabled className="bg-slate-50" />
                  <p className="text-xs text-slate-500">Email cannot be changed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="Enter your full name" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleProfileSave} disabled={isSavingProfile} className="bg-lamaPurple hover:bg-lamaPurple/90 text-white">
                  {isSavingProfile ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-500" />
                Password & Security
              </CardTitle>
              <CardDescription>Manage your password and authentication methods.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input 
                    id="currentPassword" 
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input 
                    id="newPassword" 
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                 <Button onClick={handlePasswordUpdate} disabled={loading} className="bg-lamaPurple hover:bg-lamaPurple/90 text-white">
                   {loading ? (
                     <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating...</>
                   ) : (
                     'Update Password'
                   )}
                 </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-red-100 bg-red-50/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Account
              </CardTitle>
              <CardDescription>Permanently remove your account and all associated data.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                {isDeleting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
                ) : (
                  'Delete Account'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
