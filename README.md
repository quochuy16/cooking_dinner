# 🍲 Tối nay ăn gì hả vợ?

Web nhỏ giúp vợ chọn lần lượt **món mặn → canh → rau → tráng miệng** cho bữa tối. Chọn xong có ngay thực đơn và danh sách đi chợ để gửi cho chồng.

## Tính năng

- **Chọn kiểu bữa** (Nhanh gọn / Cơm nhà / Thịnh soạn) và số người. Kiểu bữa lọc món theo thời gian nấu.
- **Chọn từng bước**: chạm vào món là tự chuyển sang bước tiếp theo. Có nút 🎲 *Chọn hộ* và ✍️ *Món khác* để thêm món của nhà mình.
- **🎲 Chọn đại giùm em**: tạo nguyên một thực đơn ngẫu nhiên, tránh những món đã ăn trong 3 ngày gần nhất.
- **Thực đơn tối nay**: đổi từng món, danh sách đi chợ có ô tích, nút 💌 *Gửi chồng* (chia sẻ qua Zalo/Messenger hoặc sao chép).
- **📒 Nhật ký**: lưu các bữa đã chốt, báo “Hôm qua vừa ăn”, thống kê món hay ăn nhất, nút *Ăn lại bữa này*.
- Ưu tiên giao diện điện thoại, tự chuyển chế độ tối. Dữ liệu lưu trong trình duyệt (localStorage), không cần server.

## Chạy thử trên máy

Mở thẳng `index.html` bằng trình duyệt, hoặc:

```bash
npx serve .
```

## Đẩy lên GitHub

```bash
git init
git add .
git commit -m "Tối nay ăn gì hả vợ"
git branch -M main
git remote add origin https://github.com/<ten-ban>/toi-nay-an-gi.git
git push -u origin main
```

## Deploy lên Vercel

1. Vào https://vercel.com/new và chọn repo vừa push.
2. **Framework Preset**: `Other`. Không cần Build Command, Output Directory để trống.
3. Bấm **Deploy**. Xong rồi gửi link cho vợ, và trên điện thoại chọn *Thêm vào màn hình chính* để mở như một app.

Hoặc dùng CLI: `npx vercel --prod`

## Sửa danh sách món

Mở `data.js` và thêm món vào nhóm tương ứng (`man`, `canh`, `rau`, `trang`):

```js
{ id: 'bun-cha', name: 'Bún chả', emoji: '🍜', time: 45, ing: ['Thịt ba chỉ', 'Bún', 'Rau sống'] },
```
