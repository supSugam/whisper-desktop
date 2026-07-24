import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useToastStore } from '../stores/useToastStore';
import type { HistoryItem as HistoryItemType } from '../types';
import { Card, Flex, Text, Badge, IconButton } from '@radix-ui/themes';
import { Copy, FolderOpen, Trash2 } from 'lucide-react';

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

interface Props {
  item: HistoryItemType;
}

export const HistoryItem: React.FC<Props> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const removeItem = useHistoryStore(state => state.removeItem);
  const showToast = useToastStore(state => state.show);

  const handleCopy = async () => {
    try {
      await writeText(item.text);
      showToast('Copied to clipboard');
    } catch (e) {
      console.error(e);
      showToast('Failed to copy');
    }
  };

  const handleDelete = async () => {
    await removeItem(item.timestamp);
  };

  const handleOpenFolder = async () => {
    if (item.srtPath) {
      try {
        await invoke('open_folder', { path: item.srtPath });
      } catch (e) {
        console.error(e);
        showToast('Failed to open folder');
      }
    }
  };

  const isLong = item.text.length > 100;
  const displayText = expanded || !isLong ? item.text : `${item.text.slice(0, 100)}…`;

  return (
    <Card size="2" style={{ backgroundColor: item.error ? 'var(--red-2)' : undefined }}>
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center">
          <Text size="2" color="gray">{timeAgo(item.timestamp)}</Text>
          {item.backend && (
            <Badge size="1" color="gray">
              {item.backend}
            </Badge>
          )}
        </Flex>

        <Text
          size="2"
          as="div"
          style={{ cursor: isLong ? 'pointer' : 'default', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
          onClick={() => isLong && setExpanded(!expanded)}
          color={item.error ? 'red' : undefined}
        >
          {item.isSrt ? `📄 ${displayText}` : displayText}
        </Text>

        {(item.processingTime !== undefined || item.duration > 0) && (
          <Flex gap="3">
            {item.processingTime !== undefined && (
              <Text size="1" color="gray">
                {(item.processingTime / 1000).toFixed(1)}s processing
              </Text>
            )}
            {item.duration > 0 && (
              <Text size="1" color="gray">
                {(item.duration / 1000).toFixed(1)}s audio
              </Text>
            )}
          </Flex>
        )}

        <Flex gap="2" justify="end" mt="1">
          <IconButton size="1" variant="soft" color="gray" onClick={handleCopy} title="Copy">
            <Copy size={14} />
          </IconButton>
          {item.isSrt && item.srtPath && (
            <IconButton size="1" variant="soft" color="gray" onClick={handleOpenFolder} title="Open folder">
              <FolderOpen size={14} />
            </IconButton>
          )}
          <IconButton size="1" variant="soft" color="gray" onClick={handleDelete} title="Delete">
            <Trash2 size={14} />
          </IconButton>
        </Flex>
      </Flex>
    </Card>
  );
};
