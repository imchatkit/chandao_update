const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // 设置背景
    ctx.fillStyle = '#006af1';
    ctx.fillRect(0, 0, size, size);

    // 绘制甘特图样式的图形
    ctx.fillStyle = '#ffffff';
    const barHeight = size * 0.2;
    const barWidth = size * 0.6;
    const startX = (size - barWidth) / 2;
    const startY = (size - barHeight) / 2;

    // 绘制时间轴
    ctx.fillRect(startX, startY + barHeight + 2, barWidth, 2);

    // 绘制任务条
    ctx.fillRect(startX, startY, barWidth * 0.7, barHeight);

    // 绘制进度条
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(startX, startY, barWidth * 0.4, barHeight);

    return canvas;
}

function saveIcon(size) {
    const canvas = generateIcon(size);
    const buffer = canvas.toBuffer('image/png');
    const iconPath = path.join(__dirname, 'icons', `icon${size}.png`);
    fs.writeFileSync(iconPath, buffer);
    console.log(`Generated ${iconPath}`);
}

// 确保icons目录存在
if (!fs.existsSync(path.join(__dirname, 'icons'))) {
    fs.mkdirSync(path.join(__dirname, 'icons'));
}

// 生成不同尺寸的图标
[16, 48, 128].forEach(size => saveIcon(size)); 