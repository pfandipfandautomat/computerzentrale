import { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon,
  Key, 
  Send,
  Save,
  Trash2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
  SidebarDivider,
} from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/services/api';
import { useAlertingStore } from '@/stores/useAlertingStore';
import { cn } from '@/lib/utils';
import { ScrollProgress } from '@/components/ui/scroll-progress';

type SettingsTab = 'ssh-key' | 'telegram';

interface Tab {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  color: string;
}

const tabs: Tab[] = [
  { id: 'ssh-key', label: 'SSH Key', icon: Key, color: 'text-amber-400' },
  { id: 'telegram', label: 'Telegram', icon: Send, color: 'text-sky-400' },
];

// ============================================================================
// SSH Key Settings Content
// ============================================================================
function SSHKeyContent() {
  const [sshKey, setSSHKey] = useState('');
  const [hasSSHKey, setHasSSHKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const status = await fetch('/api/monitoring/ssh-key-status').then(r => r.json());
        setHasSSHKey(status.hasSSHKey);
      } catch (error) {
        console.error('Failed to fetch SSH key status:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleSave = async () => {
    if (!sshKey.trim()) {
      toast({
        title: 'SSH key required',
        description: 'Paste your private SSH key to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await api.updateMonitoringSettings({ sshKey });
      setHasSSHKey(true);
      setSSHKey('');
      toast({
        description: 'SSH key saved',
      });
    } catch (error) {
      toast({
        title: 'Could not save SSH key',
        description: 'Check your network connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await api.updateMonitoringSettings({ sshKey: '' });
      setHasSSHKey(false);
      toast({
        description: 'SSH key removed',
      });
    } catch (error) {
      toast({
        title: 'Could not remove SSH key',
        description: 'Check your network connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-secondary/30 rounded animate-pulse" />
        <div className="h-64 bg-secondary/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SSH Key</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the private SSH key for connecting to nodes
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {hasSSHKey ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium">Key configured</span>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Active
            </Badge>
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No key configured</span>
          </>
        )}
      </div>

      {/* Key Input */}
      <div className="space-y-3">
        <Label htmlFor="ssh-key">Private SSH Key</Label>
        <Textarea
          id="ssh-key"
          value={sshKey}
          onChange={(e) => setSSHKey(e.target.value)}
          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
          className="min-h-[240px] font-mono text-xs bg-background/50 border-border/50"
        />
        <p className="text-xs text-muted-foreground">
          Paste your private SSH key here. It will be stored securely and used for SSH connections to nodes.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border/50">
        <Button onClick={handleSave} disabled={isSaving || !sshKey.trim()}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Key'}
        </Button>
        {hasSSHKey && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive" disabled={isSaving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Key
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove SSH Key?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the stored SSH key. You won't be able to connect to nodes via SSH until you add a new key.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear} className="bg-destructive hover:bg-destructive/90">
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Telegram Settings Content
// ============================================================================
function TelegramContent() {
  const {
    telegramConfig,
    isLoadingTelegramConfig,
    fetchTelegramConfig,
    saveTelegramConfig,
    testTelegramConnection,
  } = useAlertingStore();

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetchTelegramConfig();
  }, [fetchTelegramConfig]);

  useEffect(() => {
    if (telegramConfig) {
      if (telegramConfig.chatId) setChatId(telegramConfig.chatId);
      if (telegramConfig.enabled !== undefined) setEnabled(telegramConfig.enabled);
    }
  }, [telegramConfig]);

  const handleSave = async () => {
    if (!botToken && !telegramConfig?.botTokenSet) {
      toast({
        title: 'Bot token required',
        description: 'Enter your bot token from @BotFather to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (!chatId) {
      toast({
        title: 'Chat ID required',
        description: 'Enter your Telegram chat ID to receive alerts.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const success = await saveTelegramConfig({
      botToken: botToken || 'KEEP_EXISTING',
      chatId,
      enabled,
    });
    setIsSaving(false);

    if (success) {
      setBotToken('');
      toast({
        description: 'Telegram configuration saved',
      });
    } else {
      toast({
        title: 'Could not save configuration',
        description: 'Check your network connection and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async () => {
    const tokenToTest = botToken || (telegramConfig?.botTokenSet ? 'USE_EXISTING' : '');
    if (!tokenToTest || !chatId) {
      toast({
        title: 'Missing credentials',
        description: 'Enter both bot token and chat ID to test the connection.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    const result = await testTelegramConnection(tokenToTest, chatId);
    setIsTesting(false);

    if (result.success) {
      toast({
        description: 'Test message sent! Check your Telegram.',
      });
    } else {
      toast({
        title: 'Test failed',
        description: result.error || 'Check your bot token and chat ID are correct.',
        variant: 'destructive',
      });
    }
  };

  if (isLoadingTelegramConfig) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-secondary/30 rounded animate-pulse" />
        <div className="h-64 bg-secondary/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Telegram Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure Telegram bot for receiving alerts
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {telegramConfig?.configured ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium">Configured</span>
            <Badge 
              variant="outline" 
              className={cn(
                telegramConfig.enabled 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {telegramConfig.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Not configured</span>
          </>
        )}
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bot-token">Bot Token</Label>
          <Input
            id="bot-token"
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={telegramConfig?.botTokenSet ? '••••••••••' : 'Enter bot token from @BotFather'}
            className="bg-background/50 border-border/50"
          />
          <p className="text-xs text-muted-foreground">
            Get your bot token from @BotFather on Telegram
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="chat-id">Chat ID</Label>
          <Input
            id="chat-id"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Enter chat ID or user ID"
            className="bg-background/50 border-border/50"
          />
          <p className="text-xs text-muted-foreground">
            Your Telegram user ID or group chat ID
          </p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div>
            <Label htmlFor="telegram-enabled" className="text-sm font-medium">Enable Notifications</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive alerts when nodes go offline
            </p>
          </div>
          <Switch
            id="telegram-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border/50">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={isTesting}>
          <MessageSquare className="h-4 w-4 mr-2" />
          {isTesting ? 'Sending...' : 'Test Connection'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Settings Sidebar
// ============================================================================
function SettingsSidebar({ 
  activeTab, 
  onTabChange 
}: { 
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  return (
    <Sidebar>
      <SidebarHeader
        title="Settings"
        icon={<SettingsIcon className="h-5 w-5" />}
        action={
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0 invisible"
            disabled
          >
            <Plus className="h-4 w-4" />
          </Button>
        }
      />
      
      <SidebarNav>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <SidebarNavItem
              key={tab.id}
              icon={<Icon className="h-4 w-4" />}
              iconColor={tab.color}
              label={tab.label}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          );
        })}
      </SidebarNav>
      
      <SidebarDivider />
    </Sidebar>
  );
}

// ============================================================================
// Main Settings Page
// ============================================================================
export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ssh-key');

  return (
    <div className="flex h-full">
      <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <ScrollProgress>
        {activeTab === 'ssh-key' && <SSHKeyContent />}
        {activeTab === 'telegram' && <TelegramContent />}
      </ScrollProgress>
    </div>
  );
}
