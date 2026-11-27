import { useEffect, useState } from 'react';
import { onStatsChoice, statsChoice, type StatsChoice } from '@/utils/analytics';

/** The visitor's answer to "Allow anonymous stats?", kept current wherever it is changed. */
export function useStatsChoice(): StatsChoice {
  const [choice, setChoice] = useState<StatsChoice>(statsChoice);
  useEffect(() => onStatsChoice(() => setChoice(statsChoice())), []);
  return choice;
}
