#!/bin/bash
# filepath: c:\xampp\htdocs\myapp1\vpn-flatform1\scripts\deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV=${1:-development}
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

echo -e "${BLUE}🚀 VPN Platform Deployment Script${NC}"
echo -e "${YELLOW}Environment: ${DEPLOY_ENV}${NC}"
echo "=================================="

# Function to print colored messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    print_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Docker and Docker Compose are available"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f ".env.example" ]; then
            print_warning ".env file not found. Copying from .env.example"
            cp .env.example .env
            print_warning "Please configure .env file with your settings before continuing"
            read -p "Press Enter after configuring .env file..."
        else
            print_error ".env file not found and no .env.example available"
            exit 1
        fi
    fi
    
    # Check if required environment variables are set
    source .env
    
    required_vars=("DB_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] || [ "${!var}" = "your-" ] || [[ "${!var}" == *"change-this"* ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Please configure the following environment variables in .env:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Setup environment-specific configuration
setup_environment() {
    print_info "Setting up $DEPLOY_ENV environment..."
    
    case $DEPLOY_ENV in
        "production")
            DOCKER_COMPOSE_FILE="docker-compose.yml"
            echo "NODE_ENV=production" >> .env.tmp
            ;;
        "staging")
            DOCKER_COMPOSE_FILE="docker-compose.yml"
            echo "NODE_ENV=staging" >> .env.tmp
            ;;
        "development")
            DOCKER_COMPOSE_FILE="docker-compose.yml"
            echo "NODE_ENV=development" >> .env.tmp
            ;;
        *)
            print_error "Invalid environment: $DEPLOY_ENV. Use: development, staging, or production"
            exit 1
            ;;
    esac
    
    if [ -f .env.tmp ]; then
        cat .env >> .env.tmp
        mv .env.tmp .env
    fi
    
    print_status "Environment configuration completed"
}

# Build Docker images
build_images() {
    print_info "Building Docker images..."
    
    docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache
    
    print_status "Docker images built successfully"
}

# Setup SSL certificates (for production)
setup_ssl() {
    if [ "$DEPLOY_ENV" = "production" ]; then
        print_info "Setting up SSL certificates..."
        
        mkdir -p docker/ssl
        
        if [ ! -f "docker/ssl/cert.pem" ] || [ ! -f "docker/ssl/key.pem" ]; then
            print_warning "SSL certificates not found. Generating self-signed certificates..."
            
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout docker/ssl/key.pem \
                -out docker/ssl/cert.pem \
                -subj "/C=US/ST=CA/L=SF/O=VPN/OU=Platform/CN=localhost"
            
            print_warning "Self-signed certificates generated. For production, replace with valid certificates."
        fi
        
        print_status "SSL certificates configured"
    fi
}

# Initialize database
init_database() {
    print_info "Initializing database..."
    
    # Start only the database service first
    docker-compose -f $DOCKER_COMPOSE_FILE up -d mysql
    
    # Wait for database to be ready
    print_info "Waiting for database to be ready..."
    sleep 30
    
    # Run database migrations if they exist
    if [ -d "database/migrations" ]; then
        print_info "Running database migrations..."
        # You can add migration commands here
    fi
    
    print_status "Database initialized"
}

# Run security checks
security_check() {
    if [ "$DEPLOY_ENV" = "production" ]; then
        print_info "Running security checks..."
        
        # Check for default passwords
        if grep -q "password_123" .env; then
            print_error "Default passwords found in .env file. Please change them."
            exit 1
        fi
        
        # Check for debug mode
        if grep -q "DEBUG_MODE=true" .env; then
            print_warning "Debug mode is enabled. Consider disabling for production."
        fi
        
        # Check file permissions
        chmod 600 .env
        
        print_status "Security checks completed"
    fi
}

# Deploy application
deploy_application() {
    print_info "Deploying VPN Platform..."
    
    # Stop existing containers
    docker-compose -f $DOCKER_COMPOSE_FILE down
    
    # Start all services
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    # Wait for services to be ready
    print_info "Waiting for services to start..."
    sleep 60
    
    print_status "VPN Platform deployed successfully"
}

# Health check
health_check() {
    print_info "Performing health check..."
    
    # Check if main application is responding
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:3000/api/system/health > /dev/null 2>&1; then
            print_status "Application is healthy"
            break
        fi
        
        attempt=$((attempt + 1))
        print_info "Waiting for application to start... (attempt $attempt/$max_attempts)"
        sleep 10
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Health check failed. Application may not be running properly."
        print_info "Check logs with: docker-compose logs"
        exit 1
    fi
}

# Show deployment information
show_deployment_info() {
    print_status "Deployment completed successfully!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Main Application:    http://localhost:3000"
    echo "   Admin Dashboard:     http://localhost:3000/admin"
    echo "   API Documentation:   http://localhost:3000/docs"
    echo "   Grafana Dashboard:   http://localhost:3001 (admin/admin_password_123)"
    echo "   Kibana Logs:         http://localhost:5601"
    echo "   Prometheus:          http://localhost:9090"
    echo ""
    echo "📊 VPN Ports:"
    echo "   OpenVPN:             1194/udp"
    echo "   WireGuard:           51820/udp"
    echo "   IKEv2:               500/udp, 4500/udp"
    echo ""
    echo "🔧 Management Commands:"
    echo "   View logs:           docker-compose logs -f"
    echo "   Stop services:       docker-compose down"
    echo "   Restart services:    docker-compose restart"
    echo "   Update application:  ./scripts/deploy.sh $DEPLOY_ENV"
    echo ""
    echo "📁 Important files:"
    echo "   Configuration:       .env"
    echo "   VPN configs:         stored in Docker volumes"
    echo "   Logs:                docker-compose logs or ./logs/"
    echo "   Backups:             ./backups/ or Docker volumes"
    echo ""
    
    if [ "$DEPLOY_ENV" = "production" ]; then
        echo "🔒 Production Security Notes:"
        echo "   - Change default passwords immediately"
        echo "   - Configure valid SSL certificates"
        echo "   - Set up firewall rules"
        echo "   - Configure backup strategy"
        echo "   - Monitor logs and alerts"
        echo ""
    fi
}

# Cleanup function
cleanup() {
    if [ -f .env.tmp ]; then
        rm .env.tmp
    fi
}

# Main deployment flow
main() {
    trap cleanup EXIT
    
    check_docker
    check_prerequisites
    setup_environment
    security_check
    setup_ssl
    build_images
    init_database
    deploy_application
    health_check
    show_deployment_info
}

# Parse command line arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "VPN Platform Deployment Script"
        echo ""
        echo "Usage: $0 [environment]"
        echo ""
        echo "Environments:"
        echo "  development  - Development environment (default)"
        echo "  staging      - Staging environment"
        echo "  production   - Production environment"
        echo ""
        echo "Examples:"
        echo "  $0                    # Deploy to development"
        echo "  $0 production         # Deploy to production"
        echo "  $0 help               # Show this help"
        exit 0
        ;;
    *)
        main
        ;;
esac
