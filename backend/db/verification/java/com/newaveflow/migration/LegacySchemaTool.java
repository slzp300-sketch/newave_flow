package com.newaveflow.migration;

import org.hibernate.cfg.Configuration;
import java.nio.file.*;
import java.sql.*;

/** Builds only an empty local verification database; never starts the legacy application. */
public class LegacySchemaTool {
    public static void main(String[] args) throws Exception {
        String url=System.getenv("MIGRATION_TEST_JDBC_URL");
        if (url == null || !url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/newave_migration_[a-z0-9_]+"))
            throw new IllegalArgumentException("Only an explicitly named local migration test DB is permitted");
        String user=System.getenv("MIGRATION_TEST_USER"), password=System.getenv("MIGRATION_TEST_PASSWORD");
        try (var c=DriverManager.getConnection(url,user,password);var s=c.createStatement();var r=s.executeQuery("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")) {
            r.next(); if(r.getLong(1)!=0) throw new IllegalStateException("The baseline DB must be empty");
        }
        var cfg=new Configuration();
        cfg.setProperty("hibernate.connection.url",url);
        cfg.setProperty("hibernate.connection.username",user);
        cfg.setProperty("hibernate.connection.password",password);
        cfg.setProperty("hibernate.hbm2ddl.auto","create");
        cfg.setProperty("hibernate.hbm2ddl.halt_on_error","true");
        cfg.setPhysicalNamingStrategy(new org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy());
        try(var files=Files.list(Path.of(args[0],"com/newaveflow/entity"))) {
            for(var file:files.filter(p->p.toString().endsWith(".java")).toList()) {
                Class<?> entity=Class.forName("com.newaveflow.entity."+file.getFileName().toString().replace(".java",""));
                if(entity.isAnnotationPresent(jakarta.persistence.Entity.class)) cfg.addAnnotatedClass(entity);
            }
        }
        try(var factory=cfg.buildSessionFactory()) { System.out.println("Pre-migration entity schema created successfully"); }
    }
}
