# Requirements Document

## Introduction

The Bulletin Board is a single shared group-chat room inside the dashboard where every signed-in user (admin, CSR, operator, sub-operator, and purchaser) sees the same feed of messages and can post into it. Each message is rendered as a chat bubble / card showing the sender's avatar, display name, role, body text, attachments (images and videos), and timestamp. Anyone in the room sees every other person's message in chronological order, just like a group conversation. The admin has moderator powers — pin messages, delete any message — while regular users can only delete their own. Optional in-thread replies (quote-reply) let users respond to a specific earlier message.

The feature reuses the existing `messages` table from `backend/src/config/init.js`, the multer-based upload pipeline at `<backend>/src/public/uploads`, and the auth context that already exposes user identity and role. It follows the same upload conventions as the announcements feature in `posts.routes.js`: JPG, PNG, and MP4 only.

## Glossary

- **Bulletin_Board**: The dashboard page at `/app/bulletin-board` that renders the group-chat room.
- **Group_Chat_Room**: The single shared message stream visible to every signed-in user, regardless of role.
- **Chat_Feed**: The read API and UI list that returns Chat Messages in the Group_Chat_Room, paginated and ordered chronologically.
- **Chat_Message**: A single post in the Group_Chat_Room persisted in the `messages` table, optionally with attachments and an optional reply-to reference.
- **Message_Service**: The backend service that creates, deletes, pins, and updates read state on Chat Messages.
- **Attachment_Store**: The static file storage at `<backend>/src/public/uploads`, served at `/uploads/*`, that holds image and video files attached to Chat Messages.
- **Attachment**: A single image or video file attached to a Chat Message, referenced by its `/uploads/<filename>` URL.
- **Sender**: The signed-in user who authored a Chat Message; identified by `messages.sender_id`.
- **Admin**: A user whose `usertype` is `admin`. Acts as moderator of the Group_Chat_Room.
- **Sub_Operator**: An operator profile whose `parent_operator_id` is non-null; treated as `operator` for permissions on this feature.
- **Accepted_Media_Types**: The set of file extensions `.jpg`, `.jpeg`, `.png`, `.mp4` paired with MIME types `image/jpeg`, `image/png`, `video/mp4`.
- **Message_Card**: The visual chat-bubble component rendering one Chat Message (avatar, name, role, body, attachments, timestamp, reply-to quote, pin badge if pinned).
- **Reply_To**: An optional reference from a Chat Message to an earlier Chat Message in the same Group_Chat_Room.
- **Pinned_Message**: A Chat Message marked as pinned by the Admin and shown above the live feed.
- **Last_Read_Marker**: A per-user record of the most recent Chat Message id the user has seen, used to compute unread counts.

## Requirements

### Requirement 1: Compose and Post a Message

**User Story:** As a signed-in user, I want to post a message into the group chat, so that I can communicate with everyone in the room.

#### Acceptance Criteria

1. WHEN a signed-in user submits a Chat Message with body text of length 1 to 2000 characters, THE Message_Service SHALL persist the Chat Message with the sender's user id and the current server timestamp.
2. IF a Chat Message submission has empty or whitespace-only body text and zero Attachments, THEN THE Message_Service SHALL reject the request with HTTP status 400 and error code `EMPTY_MESSAGE`.
3. IF a Chat Message submission has body text longer than 2000 characters, THEN THE Message_Service SHALL reject the request with HTTP status 400 and error code `MESSAGE_TOO_LONG`.
4. IF a Chat Message submission lacks an authenticated Sender identity, THEN THE Message_Service SHALL reject the request with HTTP status 401 and error code `UNAUTHENTICATED`.
5. WHEN a Chat Message is persisted, THE Message_Service SHALL initialize `is_pinned` to `false`, `reply_to_id` to the supplied value or null, and `created_at` to the current server timestamp.

### Requirement 2: Attach Images and Videos

**User Story:** As a Sender, I want to attach images and videos to my message, so that I can share visual context with the group.

#### Acceptance Criteria

1. WHERE Attachments are provided on a Chat Message submission, THE Message_Service SHALL accept files whose extension and MIME type are both members of Accepted_Media_Types.
2. IF any Attachment on a submission has an extension or MIME type outside Accepted_Media_Types, THEN THE Message_Service SHALL reject the request with HTTP status 400 and error code `ATTACHMENT_TYPE_REJECTED`.
3. THE Message_Service SHALL accept at most 5 Attachments per Chat Message.
4. IF a submission contains more than 5 Attachments, THEN THE Message_Service SHALL reject the request with HTTP status 400 and error code `ATTACHMENT_LIMIT_EXCEEDED`.
5. THE Message_Service SHALL accept Attachment files up to 10485760 bytes (10 MB) each.
6. IF any Attachment exceeds 10485760 bytes, THEN THE Message_Service SHALL reject the request with HTTP status 413 and error code `ATTACHMENT_TOO_LARGE`.
7. WHEN a Chat Message submission with Attachments is accepted, THE Attachment_Store SHALL persist each Attachment under `<backend>/src/public/uploads` with a unique filename, and THE Message_Service SHALL associate the resulting `/uploads/<filename>` URLs with the Chat Message in submission order.
8. WHEN a Chat Message submission contains zero Attachments, THE Message_Service SHALL persist the Chat Message with an empty Attachment URL list.

### Requirement 3: Shared Group Feed for All Users

**User Story:** As any signed-in user, I want the bulletin board to show every user's messages in one shared feed, so that the room behaves like a group chat.

#### Acceptance Criteria

1. WHEN any signed-in user (admin, csr, operator, sub-operator, or purchaser) requests the Chat_Feed, THE Chat_Feed SHALL return Chat Messages from every Sender, with no filter on `sender_id`.
2. THE Chat_Feed SHALL order returned Chat Messages by `created_at` ascending, with `id` ascending as a tiebreaker, so the newest message appears at the bottom of the feed.
3. THE Chat_Feed SHALL include for each Chat Message: `id`, body text, Attachment URL list, `created_at`, `is_pinned`, sender id, sender display name, sender profile picture URL, sender role, `reply_to_id`, and a quoted summary of the replied-to Chat Message (sender display name, body text truncated to 120 characters, and Attachment count) when `reply_to_id` is non-null.
4. IF an unauthenticated request reaches the Chat_Feed endpoint, THEN THE Chat_Feed SHALL reject the request with HTTP status 401 and error code `UNAUTHENTICATED`.

### Requirement 4: Pagination and Live Updates

**User Story:** As a viewer, I want the chat to load in pages and to surface new messages as they arrive, so that the room stays responsive without reloading.

#### Acceptance Criteria

1. THE Chat_Feed SHALL accept a `before_id` query parameter that is a positive integer used to fetch older Chat Messages whose `id` is less than `before_id`.
2. THE Chat_Feed SHALL accept an `after_id` query parameter that is a non-negative integer used to fetch newer Chat Messages whose `id` is greater than `after_id`.
3. THE Chat_Feed SHALL accept a `limit` query parameter that is an integer in the inclusive range 1 to 100.
4. WHERE the `limit` query parameter is omitted, THE Chat_Feed SHALL apply a default page size of 50.
5. IF `limit` is outside the range 1 to 100, THEN THE Chat_Feed SHALL reject the request with HTTP status 400 and error code `INVALID_LIMIT`.
6. IF `before_id` and `after_id` are both supplied on the same request, THEN THE Chat_Feed SHALL reject the request with HTTP status 400 and error code `INVALID_CURSOR`.
7. WHEN no cursor parameters are supplied, THE Chat_Feed SHALL return the most recent `limit` Chat Messages ordered ascending by `created_at`.
8. THE Bulletin_Board SHALL poll the Chat_Feed `after_id` endpoint on an interval no longer than 5 seconds while the page is in the foreground, appending any newly returned Chat Messages to the bottom of the feed.

### Requirement 5: Reply To a Message

**User Story:** As a Sender, I want to reply to a specific earlier message, so that conversations remain coherent in the group chat.

#### Acceptance Criteria

1. WHERE a Chat Message submission supplies a `reply_to_id` referencing an existing Chat Message, THE Message_Service SHALL persist the new Chat Message with `reply_to_id` set to that id.
2. IF a Chat Message submission supplies a `reply_to_id` that does not reference any existing Chat Message, THEN THE Message_Service SHALL reject the request with HTTP status 400 and error code `REPLY_TARGET_NOT_FOUND`.
3. WHEN a Chat Message with a non-null `reply_to_id` is rendered, THE Message_Card SHALL display a quoted summary of the replied-to Chat Message above the new message body, including the original Sender display name and a truncated preview of the original body.
4. WHEN a viewer activates the quoted summary, THE Bulletin_Board SHALL scroll to and briefly highlight the original Chat Message in the feed.
5. WHERE the replied-to Chat Message has been deleted, THE Message_Card SHALL render the quote area with the placeholder text `Original message deleted` and disable the scroll-to-original action.

### Requirement 6: Card-Based Display

**User Story:** As a viewer, I want each message rendered as a chat card with the sender's identity and content, so that I can scan the conversation at a glance.

#### Acceptance Criteria

1. THE Bulletin_Board SHALL render each Chat Message as a Message_Card containing the Sender's profile picture, Sender display name, Sender role label, message body, Attachment previews, posted timestamp, and pin badge when `is_pinned` is true.
2. WHERE a Sender has a null `profile_picture`, THE Bulletin_Board SHALL render a default avatar derived from the Sender display name's initials.
3. WHERE a Chat Message has Attachments with image MIME types, THE Bulletin_Board SHALL render each image as a thumbnail preview inside the Message_Card.
4. WHERE a Chat Message has Attachments with video MIME types, THE Bulletin_Board SHALL render each video with HTML5 playback controls inside the Message_Card.
5. WHEN a viewer activates an Attachment thumbnail, THE Bulletin_Board SHALL open the Attachment in a full-size lightbox overlay.
6. WHERE a Chat Message has a non-null `reply_to_id`, THE Message_Card SHALL render the reply-to quote summary as specified in Requirement 5 acceptance criterion 3.
7. THE Bulletin_Board SHALL group consecutive Chat Messages from the same Sender into a visual cluster, showing the avatar and display name only on the first card of each cluster while keeping subsequent cards aligned and timestamped.

### Requirement 7: Delete a Message

**User Story:** As a Sender, I want to delete my own message, and as an Admin I want to delete any message, so that the chat can be cleaned up.

#### Acceptance Criteria

1. WHEN a Sender requests deletion of a Chat Message whose `sender_id` equals the requester's user id, THE Message_Service SHALL remove the Chat Message and all associated Attachment URL references.
2. WHEN an Admin requests deletion of any Chat Message, THE Message_Service SHALL remove the Chat Message and all associated Attachment URL references.
3. IF a requester is neither the Sender of the target Chat Message nor an Admin, THEN THE Message_Service SHALL reject the deletion request with HTTP status 403 and error code `FORBIDDEN`.
4. IF a deletion request targets a Chat Message id that does not exist, THEN THE Message_Service SHALL respond with HTTP status 404 and error code `NOT_FOUND`.
5. WHEN a deletion succeeds, THE Attachment_Store SHALL remove the Attachment files associated with the deleted Chat Message from `<backend>/src/public/uploads`.
6. IF Attachment file removal fails after the Chat Message row has already been removed, THEN THE Message_Service SHALL log the failure and respond with HTTP status 200 indicating successful Chat Message deletion.

### Requirement 8: Pin a Message (Admin Moderation)

**User Story:** As an Admin, I want to pin important messages, so that everyone in the room sees them at the top of the feed.

#### Acceptance Criteria

1. WHEN an Admin pins a Chat Message, THE Message_Service SHALL set `is_pinned` to `true` on that Chat Message.
2. WHEN an Admin unpins a Chat Message, THE Message_Service SHALL set `is_pinned` to `false` on that Chat Message.
3. IF a non-admin user requests a pin or unpin operation, THEN THE Message_Service SHALL reject the request with HTTP status 403 and error code `FORBIDDEN`.
4. THE Bulletin_Board SHALL render the most recently pinned Chat Message in a sticky banner above the live feed for every viewer.
5. WHEN multiple Chat Messages are pinned, THE Bulletin_Board SHALL render the pinned banner as a horizontally scrollable list ordered by `created_at` descending.

### Requirement 9: Unread Indicator

**User Story:** As a viewer, I want to see how many messages I have not read yet, so that I know when there is new activity.

#### Acceptance Criteria

1. THE Message_Service SHALL maintain a Last_Read_Marker per user storing the highest Chat Message id that user has seen.
2. WHEN a signed-in user requests the unread count, THE Chat_Feed SHALL return the count of Chat Messages whose `id` is greater than the requester's Last_Read_Marker.
3. WHEN a signed-in user opens the Bulletin_Board page, THE Bulletin_Board SHALL update the requester's Last_Read_Marker to the highest Chat Message id currently rendered in the viewport.
4. WHERE no Last_Read_Marker exists for a user, THE Chat_Feed SHALL treat the marker as 0 so all existing Chat Messages count as unread.

### Requirement 10: Sidebar Navigation and Access Control

**User Story:** As any signed-in user, I want a Bulletin Board link in the dashboard sidebar, so that I can reach the chat in one click.

#### Acceptance Criteria

1. THE Bulletin_Board SHALL be reachable via a sidebar entry labeled `Bulletin Board` in the dashboard sidebar for users with role admin, csr, operator, or purchaser.
2. WHEN a signed-in user with role admin, csr, operator, or purchaser activates the sidebar entry, THE Bulletin_Board SHALL navigate to the route `/app/bulletin-board`.
3. WHERE the signed-in user is a Sub_Operator, THE Bulletin_Board SHALL grant the same access as a regular operator.
4. IF an unauthenticated request reaches `/app/bulletin-board`, THEN THE Bulletin_Board SHALL redirect to the login route.
5. WHILE no user is signed in, THE Bulletin_Board sidebar entry SHALL remain hidden from the dashboard sidebar.
6. WHILE the signed-in user has a role other than admin, csr, operator, sub-operator, or purchaser, THE Bulletin_Board sidebar entry SHALL remain hidden from the dashboard sidebar.
7. WHERE the signed-in user has unread Chat Messages, THE dashboard sidebar entry SHALL display the unread count as a small numeric badge next to the `Bulletin Board` label.

### Requirement 11: Sender Identity Resolution

**User Story:** As a viewer, I want each Message_Card to show the sender's current display name and avatar, so that I can identify who sent the message.

#### Acceptance Criteria

1. WHEN the Chat_Feed assembles a Message_Card payload, THE Chat_Feed SHALL resolve sender display name from `users.name`, sender profile picture URL from `users.profile_picture`, and sender role from `users.usertype` using the current `users` row referenced by `messages.sender_id`.
2. WHERE a Chat Message's `sender_id` references a user row that has been deleted, THE Chat_Feed SHALL render the Sender display name as `Deleted user` and the Sender profile picture URL as null.

### Requirement 12: Group Chat Integrity and Authorization Invariants

**User Story:** As a stakeholder, I want the Group_Chat_Room to preserve message integrity and authorization rules across all operations, so that posted messages, attachments, and authorship remain consistent and access is correctly enforced.

#### Acceptance Criteria

1. WHEN a Chat Message is successfully created and subsequently fetched by any signed-in user, THE Chat_Feed SHALL return body text and Attachment URL list equal to the values supplied at creation (round-trip property over create then read).
2. WHEN a Chat Message is successfully created, THE Chat_Feed SHALL include that Chat Message in every signed-in user's response (shared visibility invariant).
3. THE Message_Service SHALL associate each persisted Attachment URL with exactly one Chat Message (attachment ownership invariant).
4. THE Message_Service SHALL accept a Chat Message deletion only when the requester's user id equals the target Chat Message's `sender_id` or the requester's role equals admin (delete authorization invariant).
5. THE Message_Service SHALL accept a pin or unpin mutation only when the requester's role equals admin (pin authorization invariant).
6. THE Message_Service SHALL ensure every persisted Attachment has an extension and MIME type both within Accepted_Media_Types (file type invariant).
7. WHEN a Chat Message is deleted, THE Chat_Feed SHALL return zero rows referencing that Chat Message id on subsequent reads (delete persistence invariant).
8. THE Message_Service SHALL ensure every persisted `reply_to_id` either is null or references an existing Chat Message id at the time of insertion (reply-target referential integrity).
