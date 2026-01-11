import { aboutHeroSectionRoutes } from '@app/modules/aboutHeroSection/aboutHeroSection.route';
import { aboutSteveDerayRoutes } from '@app/modules/aboutSteveDeray/aboutSteveDeray.route';
import { associatesRoutes } from '@app/modules/associates/associates.route';
import { authRoutes } from '@app/modules/auth/auth.route';
import { blogsRoutes } from '@app/modules/blogs/blogs.route';
import { bookResourcesRoutes } from '@app/modules/bookResources/bookResources.route';
import { booksRoutes } from '@app/modules/books/books.route';
import { contentsRoutes } from '@app/modules/contents/contents.route';
import { dashboardRoutes } from '@app/modules/dashboard/dashboard.route';
import { downloadsBookRoutes } from '@app/modules/downloadsBook/downloadsBook.route';
import { freedomPathPlaningRoutes } from '@app/modules/freedomPathPlaning/freedomPathPlaning.route';
import { generateReportRoutes } from '@app/modules/generateReport/generateReport.route';
import { includedServiceRoutes } from '@app/modules/includedService/includedService.route';
import { otpRoutes } from '@app/modules/otp/otp.routes';
import serviceRouter from '@app/modules/services/service.routes';
import { testimonialRoutes } from '@app/modules/testimonial/testimonial.route';
import { toolResourceRoutes } from '@app/modules/toolResource/toolResource.route';
import { userRoutes } from '@app/modules/users/users.routes';
import { whatYourClientGetsRoutes } from '@app/modules/whatYourClientGets/whatYourClientGets.route';
import { Router } from 'express';

const router = Router();
const moduleRoutes = [
  {
    path: '/downloads-book',
    route: downloadsBookRoutes,
  },
  {
    path: '/dashboard',
    route: dashboardRoutes,
  },
  {
    path: '/about-steve-deray',
    route: aboutSteveDerayRoutes,
  },
  {
    path: '/freedom-path-planning',
    route: freedomPathPlaningRoutes,
  },
  {
    path: '/about-hero-section',
    route: aboutHeroSectionRoutes,
  },
  {
    path: '/included-service',
    route: includedServiceRoutes,
  },
  {
    path: '/what-your-client-gets',
    route: whatYourClientGetsRoutes,
  },
  {
    path: '/books',
    route: booksRoutes,
  },
  {
    path: '/blogs',
    route: blogsRoutes,
  },
  {
    path: '/book-resources',
    route: bookResourcesRoutes,
  },
  {
    path: '/tool-resource',
    route: toolResourceRoutes,
  },

  {
    path: '/testimonial',
    route: testimonialRoutes,
  },
  {
    path: '/associates',
    route: associatesRoutes,
  },
  {
    path: '/users',
    route: userRoutes,
  },
  {
    path: '/otp',
    route: otpRoutes,
  },
  {
    path: '/auth',
    route: authRoutes,
  },
  {
    path: '/contents',
    route: contentsRoutes,
  },
  {
    path: '/services',
    route: serviceRouter,
  },
  {
    path: '/generate-report',
    route: generateReportRoutes,
  },
];
moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
