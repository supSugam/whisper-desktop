import React from 'react';
import { useConfigStore } from '../stores/useConfigStore';
import { ToggleSwitch } from './shared/ToggleSwitch';
import { ICONS } from '../ui/icons';

export const TranslateToggle: React.FC = () => {
  const { config, updateSetting } = useConfigStore();
  
  // Only show for local engine
  if (config.transcriptionEngine !== 'local') {
    return null;
  }
  
  return (
    <div className="translate-toggle">
      <div className="translate-toggle-row">
        <label className="translate-label">
          <span className="translate-icon" dangerouslySetInnerHTML={{ __html: ICONS.translate }} />
          Translate to English
        </label>
        <ToggleSwitch
          checked={config.localTranslate || false}
          onChange={(checked: boolean) => updateSetting('localTranslate', checked)}
        />
      </div>
      <div className="translate-hint">
        {config.localTranslate
          ? 'All audio will be translated to English'
          : 'Audio will be transcribed in its original language'}
      </div>
    </div>
  );
};
