import { useState, useEffect } from 'react';
import { Globe, Clock, Calendar, Tag, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TAG_CONFIG, type NodeTag } from '@/types';

interface NodeOverviewProps {
  host: string;
  port?: number;
  tags: NodeTag[];
  description?: string;
  lastChecked?: string;
  createdAt: string;
  onDescriptionSave: (description: string) => Promise<void>;
  isLoading?: boolean;
}

export function NodeOverview({
  host,
  port,
  tags,
  description,
  lastChecked,
  createdAt,
  onDescriptionSave,
  isLoading,
}: NodeOverviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(description || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedDescription(description || '');
  }, [description]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onDescriptionSave(editedDescription);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedDescription(description || '');
    setIsEditing(false);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Info */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Host</span>
            <code className="text-sm font-mono bg-background/50 px-2 py-0.5 rounded">
              {host}
            </code>
          </div>
          {port && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Port</span>
              <code className="text-sm font-mono bg-background/50 px-2 py-0.5 rounded">
                {port}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      {tags.length > 0 && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const config = TAG_CONFIG[tag];
                const TagIcon = config?.icon;
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      "font-medium gap-1.5",
                      config?.bg,
                      config?.color,
                      config?.ring && `ring-1 ${config.ring}`
                    )}
                  >
                    {TagIcon && <TagIcon className="h-3 w-3" />}
                    {config?.label || tag}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Description</CardTitle>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-7 text-xs"
              >
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Add a description for this node..."
                className="min-h-[100px] resize-none bg-background/50"
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <p className={cn(
              "text-sm",
              description ? "text-foreground" : "text-muted-foreground italic"
            )}>
              {description || 'No description added yet.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Activity */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lastChecked && (
            <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Last Checked</p>
                <p className="text-sm font-medium">{formatTimeAgo(lastChecked)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">
                {new Date(createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
