# Thiết kế chuyển beta sang app Supabase

Ngày: 2026-10-10. Trạng thái: thiết kế để review, chưa triển khai production.

## Mục tiêu và quyết định của người dùng

- Giữ mốc beta hiện tại trên `main` ở commit `a5be5a8c11b34e36396564b5f88fd915d9670af7`; tag `beta-stable-2026-10-10` dùng để tham chiếu và rollback.
- Lưu bản local đang phát triển trên nhánh `codex/supabase-app`, hoàn thiện app mới để bỏ Google Apps Script hoàn toàn.
- Chuẩn bị bản beta chuyển tiếp từ mốc main ổn định, chỉ thêm tài khoản, backup/sync Supabase và thông báo trong 7 ngày; giữ nguyên backend AI Apps Script của beta trong thời gian này.
- Sau khi app mới đạt các điều kiện phát hành, thay production bằng app mới, ưu tiên giữ nguyên `https://chunk-diary.vercel.app`.
- **Dữ liệu cũ tương thích vẫn được load, kể cả người chưa đăng ký.** Tài khoản không phải điều kiện để đọc dữ liệu local. Hết 7 ngày không được xóa dữ liệu, reset DB, ép onboarding lại hoặc chặn đọc dữ liệu cũ.
- Đăng ký và sync cung cấp backup và khả năng khôi phục khi đổi trình duyệt, thiết bị hoặc origin; chỉ đăng ký mà chưa sync thành công không bảo đảm đã backup.

## Cách tách bản ổn định và bản phát triển

1. `main` giữ nguyên commit baseline trong giai đoạn chuẩn bị. Tag lưu mốc là snapshot Git, không phải cấu hình GitHub branch protection.
2. Nhánh `codex/supabase-app` chứa toàn bộ code local, SQL, Edge Function và tài liệu Apps Script người dùng bổ sung.
3. Khi triển khai beta chuyển tiếp, tạo nhánh `codex/beta-account-sync` từ baseline. Không cherry-pick toàn bộ nhánh app mới vì endpoint và hành vi tạo chunks đã thay đổi.
4. Đưa bản chuyển tiếp vào main qua PR sau kiểm thử; bản app mới chỉ vào main khi đạt điều kiện chuyển production. Không push trực tiếp main và không tự thay đổi production trong bước lưu nhánh.

## Tương thích và dữ liệu local

Production đã được kiểm tra trực tiếp: bundle `/assets/index-B8mhiAC-.js` dùng Apps Script, `LanguageChunkDiaryDB` version 4 và `StoryChatDB`.
Local cũng dùng `LanguageChunkDiaryDB` version 4. Đây là cơ sở tương thích schema, chưa phải bằng chứng round-trip đầy đủ trên dữ liệu beta thực.

- Đọc IndexedDB hiện có trước khi restore cloud. Không ghi đè local bằng một snapshot cloud rỗng hoặc cũ hơn.
- Giữ ID và quan hệ diary -> meaning unit -> chunk -> semantic group; giữ các trường sao, số lần luyện, rating và timestamps hiện có.
- Nếu cần nâng version DB, chỉ dùng migration cộng thêm có kiểm thử; không xóa/recreate store để chuyển backend.
- Dữ liệu không hợp lệ được giữ lại để export/recovery, không silently bỏ hoặc reset. Báo lỗi rõ ràng khi một bản ghi không đọc được.
- Không thay đổi tên/key dữ liệu `StoryChatDB` và các localStorage liên quan mà không có bước tương thích.
- Hai domain khác nhau không chia sẻ IndexedDB. Nếu còn beta user ở GitHub Pages, cần một bản export/bridge tại origin cũ trước khi đóng nó. Redirect đơn thuần không chuyển được dữ liệu.

## Tài khoản và backup trong beta chuyển tiếp

Giao diện cho phép đăng ký/liên kết tài khoản Supabase, đăng nhập trên thiết bị khác, sync thủ công, xem trạng thái backup và xuất/nhập JSON đầy đủ. Phương thức đăng nhập cụ thể được chọn trước khi triển khai UI.

Backup phải chứa dữ liệu gốc, không chỉ bảng `userProgress` phụ:

- `diaries`, `meaningUnits`, `chunks`, `semanticGroups`, `settings`, `englishChunks`, `userProgress`.
- Session Story Chat và các cài đặt localStorage của ứng dụng có ảnh hưởng đến việc tiếp tục dùng app.
- Không export/restore token Supabase hoặc thông tin đăng nhập trong JSON backup.

Snapshot có version, thời điểm tạo, manifest số bản ghi theo store và checksum. Upload phải xác nhận thành công trước khi hiển thị đã backup. Restore phải validate, giữ ID, merge theo chính sách rõ ràng và xác nhận transaction hoàn tất. Khi không có metadata đáng tin cậy, ưu tiên giữ local và yêu cầu lựa chọn trước khi ghi đè.

Tiến độ học lấy từ `chunks`, nơi luồng luyện tập thực sự cập nhật; không dựa riêng vào `userProgress` vốn không được cập nhật theo mỗi lần luyện. Sync cần hàng đợi bền vững, retry, xử lý mất mạng và chống upload trùng. Quyền RLS phải hỗ trợ đúng thao tác insert/select/update của upsert.

Cloud sync là lựa chọn có thông báo về nội dung được upload. Không tự thu thập nhật ký cá nhân hoặc đưa vào corpus cải thiện AI như một tác dụng phụ của backup. Anonymous identity là kỹ thuật tùy chọn, không thay thế khả năng khôi phục bằng tài khoản.

## Thông báo 7 ngày

- Bắt đầu tính 7 ngày từ thời điểm bản beta chuyển tiếp thực sự được phát hành, theo Asia/Bangkok; không tính từ ngày tạo tài liệu.
- Thông báo: app sắp chuyển backend, dữ liệu trên cùng trình duyệt vẫn được giữ nếu tương thích; khuyến nghị đăng ký và backup để chuyển thiết bị hoặc phục hồi khi xóa dữ liệu trình duyệt.
- Hiển thị hạn thông báo và trạng thái backup thực. Không tuyên bố người chưa đăng ký sẽ mất dữ liệu local.
- Kết thúc thông báo không tự kích hoạt xóa dữ liệu hoặc phát hành app chưa kiểm thử. Cutover chỉ diễn ra sau khi app mới đạt release gates.

## Port Apps Script sang app mới

Nguồn tham chiếu: `docs/app script/code.gs.txt`. Bản này lấy API key từ Script Properties, không có key Gemini hardcode được phát hiện trong bước kiểm tra pattern secrets.

Đưa toàn bộ quy tắc prompt và response schema sang Supabase Edge Function, không chỉ thay URL. Đặc biệt giữ:

- English pivot trung thành với nội dung, không thêm tình tiết.
- Cá nhân hóa chỉ đổi register/thuật ngữ đúng nghề, không thêm ý hoặc chi tiết mới.
- Mỗi semantic unit có đúng một common chunk và tối đa một personalized chunk; trường hợp không có thuật ngữ phù hợp cho phép personalized rỗng.
- Các field IPA, romanization và semantic-group assignment; schema phải được kiểm tra trước khi ghi local.

App mới cuối cùng không gọi Apps Script. Beta chuyển tiếp vẫn giữ Apps Script trong thời gian chuẩn bị. Rollback app mới dùng deployment beta đã lưu, không xóa dữ liệu đã tạo sau cutover.

## Điều kiện phát hành

1. Dữ liệu beta cũ trên cùng origin load được mà không cần đăng ký; bản ghi và quan hệ giữ nguyên sau mở app, refresh và luyện tập.
2. Backup -> restore trên thiết bị sạch tái tạo đầy đủ thư viện và tiến độ, có đối chiếu số bản ghi và ID.
3. Tài khoản đăng nhập ở thiết bị khác restore được; hai tài khoản không đọc/ghi dữ liệu của nhau.
4. Mất mạng hoặc sync lỗi không làm mất dữ liệu local; retry không tạo trùng hoặc ghi đè tiến độ mới.
5. Supabase generation đáp ứng quy tắc Apps Script và xử lý output lỗi/timeout trước khi ghi database.
6. Bản chuyển tiếp và app mới đều typecheck/build pass, có kiểm thử migration, RLS và manual beta acceptance.
7. Supabase project đúng cho ChunkDiary, Auth, migrations, secrets và Edge Function được xác nhận trước khi bật backend mới.
8. Có deployment rollback, JSON recovery và thông báo 7 ngày đã được kiểm tra; chỉ chuyển production khi được người dùng cho phép.

## Giới hạn kiểm tra hiện tại

GitHub main và local HEAD cùng baseline sau fetch. Vercel metadata không cung cấp commit SHA của deployment, nên không khẳng định production build đúng toàn bộ source baseline chỉ dựa vào Git.
Supabase đang kết nối chưa có bảng/function ChunkDiary và có function GSA; không dùng project đó làm đích migration khi chưa xác nhận.
Chưa sửa product code, chưa áp SQL, chưa thay production hoặc dữ liệu user trong bước tách nhánh và viết thiết kế này.

Thiết kế này thay thế các chỉ dẫn xung đột về thu gom tự động, bắt buộc tài khoản và đóng origin cũ trong tài liệu kế hoạch trước đây. Các bước triển khai chi tiết sẽ được chốt sau review thiết kế.
