import { test, expect } from '@playwright/test'

test('mobile nav drawer flow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  await page
    .getByRole('button', { name: /打开导航菜单|Open navigation menu/ })
    .click()

  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('link', { name: /歌曲库|Songs/ }).click()

  await expect(page).toHaveURL(/\/songs/)
  await expect(page.getByRole('dialog')).toBeHidden()
})
