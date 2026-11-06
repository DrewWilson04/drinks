export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  is_private: boolean;
  onboarded: boolean;
  created_at: string;
};

export type DrinkType =
  | "beer"
  | "wine"
  | "cocktail"
  | "shot"
  | "spirit"
  | "cider"
  | "seltzer"
  | "other";

export type Drink = {
  id: string;
  user_id: string;
  drink_type: DrinkType;
  name: string;
  volume_ml: number;
  abv: number;
  standard_drinks: number;
  notes: string;
  photo_path: string | null;
  group_id: string | null;
  consumed_at: string;
  created_at: string;
};

export type ProfileLite = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
>;

/** A drink as shown in feeds, with author, group and social counts. */
export type FeedDrink = Drink & {
  profile: ProfileLite;
  group: { id: string; name: string } | null;
  cheers: { user_id: string }[];
  comments: { count: number }[];
  photo_url?: string | null;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  kind: "group" | "event";
  starts_at: string | null;
  ends_at: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  drink_count: number;
  total_standard: number;
};

export type Comment = {
  id: string;
  drink_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile: ProfileLite;
};
