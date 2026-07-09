-- Allow blast-arena rooms
ALTER TABLE public.multiplayer_rooms
  DROP CONSTRAINT multiplayer_rooms_game_type_check;

ALTER TABLE public.multiplayer_rooms
  ADD CONSTRAINT multiplayer_rooms_game_type_check
  CHECK (game_type IN ('math-buzzer', 'typing-race', 'blast-arena'));
