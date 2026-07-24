import React, { useState } from 'react';
import { useHistoryStore } from '../stores/useHistoryStore';
import { HistoryItem } from './HistoryItem';
import { useView } from '../App';
import { Flex, Text, IconButton, ScrollArea, Box, Button, TextField, AlertDialog } from '@radix-ui/themes';
import { ChevronLeft, Search } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { setView } = useView();
  const items = useHistoryStore(state => state.items);
  const clearHistory = useHistoryStore(state => state.clearHistory);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = searchQuery
    ? items.filter(item =>
        item.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  const handleClearAll = async () => {
    await clearHistory();
  };

  return (
    <Flex direction="column" height="100%" style={{ overflow: 'hidden', backgroundColor: 'var(--color-page-background)' }}>
      <Flex align="center" justify="between" px="4" py="3" style={{ flexShrink: 0 }}>
        <Flex align="center" gap="3">
          <IconButton variant="ghost" color="gray" onClick={() => setView('main')}>
            <ChevronLeft size={18} />
          </IconButton>
          <Text size="3" weight="medium" color="gray">History</Text>
        </Flex>
        {items.length > 0 && (
          <AlertDialog.Root>
            <AlertDialog.Trigger>
              <Button variant="ghost" color="gray" size="1">
                Clear All
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Content maxWidth="450px" style={{ backgroundColor: 'var(--color-panel-solid)', borderRadius: '12px' }}>
              <AlertDialog.Title>Clear History</AlertDialog.Title>
              <AlertDialog.Description size="2">
                Are you sure you want to clear all history? This action cannot be undone.
              </AlertDialog.Description>
              <Flex gap="3" mt="4" justify="end">
                <AlertDialog.Cancel>
                  <Button variant="soft" color="gray">
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action>
                  <Button variant="solid" color="red" onClick={handleClearAll}>
                    Clear All
                  </Button>
                </AlertDialog.Action>
              </Flex>
            </AlertDialog.Content>
          </AlertDialog.Root>
        )}
      </Flex>

      <Box px="4" pb="4" style={{ flexShrink: 0, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <TextField.Root
          placeholder="Search history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        >
          <TextField.Slot>
            <Search size={16} />
          </TextField.Slot>
        </TextField.Root>
      </Box>

      <ScrollArea type="scroll" scrollbars="vertical" style={{ flexGrow: 1, overflowX: 'hidden' }}>
        <Flex 
          direction="column" 
          gap="3" 
          px="4" 
          pb="4"
          style={{ outline: 'none', maxWidth: '800px', margin: '0 auto', width: '100%' }}
          tabIndex={0}
          ref={(el) => {
            if (el && document.activeElement === document.body) {
              el.focus();
            }
          }}
        >
          {filteredItems.length > 0 ? (
            filteredItems.map(item => (
              <HistoryItem key={item.timestamp} item={item} />
            ))
          ) : (
            <Flex justify="center" pt="6" style={{ opacity: 0.5 }}>
              <Text size="2">{searchQuery ? 'No results found.' : 'No transcriptions yet.'}</Text>
            </Flex>
          )}
        </Flex>
      </ScrollArea>
    </Flex>
  );
};
