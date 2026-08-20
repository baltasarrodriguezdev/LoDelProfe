export type InstagramFormat = 'feed' | 'story';
export type InstagramTemplate =
  | 'zones'
  | 'next_matchday'
  | 'weekly_fixture'
  | 'today'
  | 'today_results'
  | 'individual_result'
  | 'matchday_results'
  | 'standings'
  | 'results_standings'
  | 'bracket'
  | 'champions';

export type InstagramManifest = {
  template: InstagramTemplate;
  format: InstagramFormat;
  width: number;
  height: number;
  description: string;
  zipFileName: string | null;
  sourceUpdatedAt: string;
  pages: Array<{ index: number; id: string; label: string; fileName: string; warnings: string[] }>;
};
