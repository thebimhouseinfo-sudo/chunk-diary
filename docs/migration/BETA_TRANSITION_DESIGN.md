# Thiết kế thay thế beta bằng Supabase App — Direct Cutover

Ngày: 2026-10-10. Phiên bản: 2.0. Trạng thái: **thiết kế cho phát hành thay thế, chưa triển khai production**.
Kế hoạch thực thi chi tiết và ưu tiên cao hơn: [APP_DEVELOPMENT_PLAN.md](../APP_DEVELOPMENT_PLAN.md) v1.3.

## Quyết định mới: chỉ phát hành khi toàn bộ app đã sẵn sàng

Theo quyết định của Human ngày 2026-10-10:

- `main` là bản beta đang hoạt động, giữ nguyên trong toàn bộ thời gian phát triển app mới; mốc tham chiếu: `a5be5a8c11b34e36396564b5f88fd915d9670af7`, tag `beta-stable-2026-10-10`.
- `codex/supabase-app` là **nhánh tích hợp phát triển chính**, chứa toàn bộ thay đổi frontend, Supabase, AI đa ngôn ngữ, bảo vệ prompt, Voice và backup/sync.
- **Không triển khai beta chuyển tiếp trên main**; không tạo nhánh `codex/beta-account-sync`, không vá tính năng account/backup vào production trước, **không có giai đoạn bắt buộc thông báo 7 ngày**.
- Bản beta hiện tại tiếp tục dùng backend Google Apps Script như cũ, không chỉnh sửa vì nhu cầu chuyển đổi; app mới phải loại bỏ phụ thuộc Apps Script khi phát hành.
- Sau khi nhánh app mới vượt qua data migration, security, AI, browser voice và E2E release gates, chỉ khi có **phê duyệt phát hành rõ ràng của Human**, mới merge/replace `main` bằng bản ứng dụng mới đã kiểm thử và thay thế deployment production trên **cùng origin** `https://chunk-diary.vercel.app`.
- **Không bắt buộc đăng ký tài khoản** để đọc dữ liệu local cũ, không ép onboarding lại, không xóa/reset IndexedDB hoặc nhật ký cũ.
- Các chức năng backup/sync, tài khoản và private AI prompt phải hoàn thiện ngay **trong nhánh app mới** trước cutover; không trông chờ bản beta chuyển tiếp để thu thập hoặc dọn dữ liệu trước.

## Ranh giới phát hành và rollback

1. Phát triển, typecheck, test migration và TTS browser tại nhánh `codex/supabase-app`, Supabase staging riêng và khi cần Vercel preview. Không deploy preview vô hạn theo từng commit.
2. Freeze chính xác source beta đã chạy, xác nhận origin production và mốc release mới. Git commit/tag beta **không tự chứng minh** mã bundle đang phục vụ người dùng nếu deployment metadata chưa đối chiếu.
3. Dựng fixture IndexedDB thật/sanitized từ bản beta, giữ nguyên ID, số bản ghi, quan hệ, metadata và tiến độ.
4. **Rehearse direct cutover trên cùng origin thử nghiệm**: chạy bản beta thật để tạo IndexedDB v4, sau đó thay frontend bằng bản mới và đo lại toàn bộ dữ liệu (không giả định chỉ test import JSON là đủ).
5. Chạy E2E và review test scripts, negative controls; xác nhận đăng nhập/đăng xuất, quyền sở hữu, RLS, prompt-private, AI schema, offline network failure, browser TTS quota/fallback.
6. Khi release gate PASS và Human phê duyệt, merge/release chính xác bản đã test vào `main` và cập nhật production deployment một lần; kiểm tra post-release trước khi tuyên bố thành công.
7. Giữ bản beta deployment cũ để **recovery**, nhưng không tự động rollback bằng binary cũ nếu DB đã nâng version: IndexedDB phiên bản cao có thể khiến beta cũ gặp `VersionError`. Phải có rollback-compatible build, verified export/recovery hoặc hướng nâng cấp khác trước khi phát hành; không xóa dữ liệu phát sinh sau cutover.
8. Mất kết nối Supabase hoặc backend mới phải **không chặn khả năng đọc/học từ dữ liệu local**. Không tự chạy lại backend Apps Script trên production như một giai đoạn bắt buộc.

**Điều kiện same-origin:** IndexedDB và localStorage bị cô lập theo origin. Chỉ thay deployment ở `https://chunk-diary.vercel.app` mới tái sử dụng trực tiếp local data lưu ở origin đó. Nếu người dùng nào còn ở GitHub Pages hoặc domain khác, cần đường export/import hoặc bridge tự nguyện riêng trước khi ngừng phục vụ origin cũ; redirect thông thường **không chuyển dữ liệu**.

## Dữ liệu beta phải tương thích 100% theo hợp đồng

Đã biết beta dùng `LanguageChunkDiaryDB` version 4 và `StoryChatDB`; gồm:

- `diaries`, `meaningUnits`, `chunks`, `semanticGroups`, `settings`, `englishChunks`, `userProgress`.
- Session Story Chat và các cài đặt `localStorage` cần để tiếp tục học.
- Tiến độ học chủ yếu nằm trong `chunks` (số lần luyện, sao, điểm đánh giá và thời gian), không dựa riêng vào `userProgress`.
- Giữ toàn bộ khóa ID và quan hệ diary → meaning unit → chunk → semantic group.
- Field mới ở app mới phải có default/normalizer an toàn; giữ dữ liệu gốc/field không nhận diện khi export, không xóa store để chuyển backend.
- Khi cần nâng schema/index/version IndexedDB, phải chứng minh migration, reopen, restore và rollback. Dữ liệu hỏng phải còn đường export/recovery và lỗi rõ ràng.

### Account và ownership

Legacy data ban đầu chưa có owner Supabase là **guest local/unclaimed**, nhưng vẫn phải đọc được ngay. Không tự nhận toàn bộ dữ liệu trên trình duyệt cho user vừa đăng nhập. Định nghĩa workspace riêng theo account, flow nhận dữ liệu guest có preview + confirm + cancel, chuyển account không thấy dữ liệu/StoryChat/sync queue của account khác, logout không xóa dữ liệu. Cùng local record ID ở hai account không được lẫn, kể cả khi offline và retry.

Cloud rows cần khóa user-scoped `(user_id,id)` hoặc tương đương, đúng `upsert(..., { onConflict: "user_id,id" })` và RLS SELECT/INSERT/UPDATE/DELETE. Không dùng text ID toàn cục để quyết định quyền sở hữu. Chỉ áp dụng migration vào đúng dự án ChunkDiary Supabase sau khi kiểm thử staging và được phép.

## Backup/restore là tính năng của app mới, không phải beta chuyển tiếp

- Backup/sync tuỳ chọn; login **không đồng nghĩa** đã backup. Đánh dấu `Backed up` chỉ khi server thực sự xác nhận dữ liệu cần thiết đã ghi.
- Snapshot đầy đủ: schemaVersion, manifest count/store, checksum, IDs, relationships, StoryChat session, settings và thống kê thật trong `chunks`. Loại trừ token đăng nhập và secrets.
- Restore có preview, validate toàn bộ snapshot, merge/conflict policies, transaction-commit verification, offline retry/idempotency. Snapshot cloud rỗng/cũ không được ghi đè local.
- Trên thiết bị khác, chỉ đảm bảo khôi phục cloud backup sau khi đồng bộ **thành công** vào một account có thể đăng nhập lại; anonymous guest token không tự bảo đảm khả năng recovery.
- 3 phạm vi riêng: **AI_PROCESSING** (user chủ động Generate, nội dung gửi tạm tới model và có thông báo rõ ràng), **BACKUP_SYNC** (lưu lâu dài có opt-in), **CORPUS_SHARE** (chia sẻ corpus có opt-in riêng, mặc định OFF). Không bao giờ đánh đồng ba quyền này.

## AI, prompt và voice của bản mới

- Frontend chỉ gửi nội dung và settings cần thiết, không chứa prompt riêng tư. Prompt nội bộ mới nằm ở kho backend có giới hạn truy cập; không hiện trong public source, frontend bundle, API/logs hoặc lỗi. Prompt cũ trong `server.ts`, Edge Function và `docs/app script/code.gs.txt` đã xuất hiện trong Git public phải xem là disclosed, không thể thu hồi bằng cách xoá khỏi bản hiện tại.
- Core AI phải đa ngôn ngữ; vẫn nhận diện dữ liệu English pivot cũ, nhưng không ép mọi ngôn ngữ đi qua tiếng Anh. Quy tắc 1 common + tối đa 1 personalized chunk trên semantic unit, không bịa nội dung, đúng phiên âm/ngôn ngữ đích; validate server trước khi lưu local.
- Voice giai đoạn này là **Web/browser**: user **chỉ đổi giọng và nghe thử**, giọng có thể thể hiện accent khác nhau, không chỉnh speed/pitch/quality. Ưu tiên Web Speech miễn phí, Cloud Neural TTS có quota cứng + fallback text/giọng browser. Offline voice, native iOS/Android TTS, quyền OS microphone/audio session thuộc phase Native riêng, không phải release gate Web.

## Gate nghiệm thu phát hành một lần

| Gate | Bằng chứng phải PASS |
|---|---|
| DATA | Beta same-origin v4 → app mới không login, reload/training/backup/restore, bảo toàn IDs, số lượng, quan hệ và thống kê |
| OWNERSHIP | Guest và hai account cùng trình duyệt/tên ID giống nhau không lộ/ghi đè/sync chéo |
| SECURITY | RLS 2 users, PK theo user, consent tách 3 loại, không rò token/prompt/nhật ký trong logs |
| AI | Prompt riêng tư mới, schema và semantic multilingual quality, timeout/error không gây mất local data |
| VOICE WEB | Browser voice preview/selection, tự fallback khi giọng/cloud quota không sẵn; không bắt buộc offline |
| RELEASE | Test thực tế trong preview/staging, Reviewer xem cả scripts, direct replacement rehearsal, rollback data-compatible và Human phê duyệt |

Không có bước release trung gian vào `main`, không yêu cầu đồng hồ 7 ngày và không tự động wipe bất kỳ dữ liệu user nào.

## Giới hạn thông tin

Bản baseline và tài liệu prior audit chưa chứng minh đầy đủ nguồn production Vercel build SHA. Dự án Supabase được kết nối trước đây có dấu hiệu thuộc GSA, không được dùng cho ChunkDiary nếu chưa xác nhận. Những điểm này là pre-release validation gates, không phải quyền để thay đổi production hiện tại.

**Tài liệu này thay thế thiết kế beta transition cũ**. Mọi chỉ dẫn trước đây về `codex/beta-account-sync`, đăng ký/backup trung gian trên `main`, thu thập nhật ký tự động hoặc cảnh báo bắt buộc 7 ngày đều không còn hiệu lực.
